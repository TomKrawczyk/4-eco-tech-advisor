import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  POSTAL_RE, THROTTLE_MS, sleep, fetchAll, extractPostalCode, geocodeOne,
} from '../../shared/gieldaShared.ts';

const LOCK_KEY = 'gielda_warmup_lock';
const LOCK_MIN_INTERVAL_MS = 5 * 60 * 1000; // throttle: max 1 warmup / 5 min (blokuje overlap i napinanie limitu odczytów)
const MAX_GEOCODE_PER_RUN = 40; // cap, żeby jedno wywołanie zmieściło się w timeoutie

const f = (r: any, key: string) => r?.data?.[key] ?? r?.[key];

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole.entities;

    // --- Lock: skip jeśli poprzedni warmup wystartował < 2 min temu ---
    const lockRows = await svc.MeetingsCache.filter({ cache_key: LOCK_KEY }, '-updated_date', 1);
    const lock = lockRows[0];
    const now = Date.now();
    const lastStart = lock?.last_refreshed ? new Date(lock.last_refreshed).getTime() : 0;
    if (lock && (now - lastStart) < LOCK_MIN_INTERVAL_MS) {
      return Response.json({ skipped: true, reason: 'lock', last_start: lock.last_refreshed });
    }

    let lockId: string;
    const nowIso = new Date().toISOString();
    if (lock) {
      await svc.MeetingsCache.update(lock.id, { cache_key: LOCK_KEY, status: 'refreshing', last_refreshed: nowIso, error_message: '' });
      lockId = lock.id;
    } else {
      const created = await svc.MeetingsCache.create({ cache_key: LOCK_KEY, status: 'refreshing', last_refreshed: nowIso });
      lockId = created.id;
    }

    // --- Odczyt encji + cache ---
    const [phoneContacts, meetingAssignments, contactLeads, cacheRows] = await Promise.all([
      fetchAll(svc.PhoneContact),
      fetchAll(svc.MeetingAssignment),
      fetchAll(svc.ContactLead),
      fetchAll(svc.PostalCodeCache),
    ]);

    const cachedCodes = new Set<string>();
    const notFoundCodes = new Set<string>();
    for (const r of cacheRows) {
      const code = String(f(r, 'postal_code') || '').trim();
      if (!code) continue;
      if (f(r, 'not_found') === true) notFoundCodes.add(code);
      else if (typeof f(r, 'lat') === 'number') cachedCodes.add(code);
    }

    const codesToGeocode = new Set<string>();
    const collect = (...fields: any[]) => {
      const c = extractPostalCode(...fields);
      if (c && !cachedCodes.has(c) && !notFoundCodes.has(c)) codesToGeocode.add(c);
    };

    for (const r of phoneContacts) {
      if (f(r, 'is_archived') === true) continue;
      collect(f(r, 'address'), f(r, 'client_address'), f(r, 'comments'));
    }
    for (const r of meetingAssignments) {
      collect(f(r, 'client_address'), f(r, 'comments'), f(r, 'notes'));
    }
    for (const r of contactLeads) {
      if (f(r, 'is_archived') === true) continue;
      collect(f(r, 'postal_code'), f(r, 'client_address'), f(r, 'notes'));
    }

    // --- Geokodowanie (Nominatim 1 req/s), cap na wywołanie ---
    const batch = [...codesToGeocode].slice(0, MAX_GEOCODE_PER_RUN);
    let geocoded = 0;
    let notFound = 0;
    for (let i = 0; i < batch.length; i += 1) {
      if (i > 0) await sleep(THROTTLE_MS);
      const code = batch[i];
      try {
        const hit = await geocodeOne(code);
        if (!hit) {
          notFound += 1;
          await svc.PostalCodeCache.create({ postal_code: code, not_found: true, cached_at: new Date().toISOString() }).catch(() => {});
          continue;
        }
        geocoded += 1;
        await svc.PostalCodeCache.create({
          postal_code: code, lat: hit.lat, lon: hit.lon, city: hit.city, display_name: hit.display_name,
          not_found: false, cached_at: new Date().toISOString(),
        }).catch(() => {});
      } catch (_e) { /* pomiń pojedynczy błąd */ }
    }

    await svc.MeetingsCache.update(lockId, {
      cache_key: LOCK_KEY, status: 'success', last_refreshed: new Date().toISOString(),
      meetings_count: geocoded, error_message: '',
    }).catch(() => {});

    return Response.json({
      skipped: false,
      geocoded,
      not_found: notFound,
      pending: codesToGeocode.size - batch.length,
      total_uncached: codesToGeocode.size,
    });
  } catch (error) {
    // zwolnij lock przy błędzie, żeby kolejny warmup mógł ruszyć
    try {
      const svc = createClientFromRequest(req).asServiceRole.entities;
      const rows = await svc.MeetingsCache.filter({ cache_key: LOCK_KEY }, '-updated_date', 1);
      if (rows[0]) await svc.MeetingsCache.update(rows[0].id, { status: 'error', error_message: String(error?.message || ''), last_refreshed: new Date().toISOString() });
    } catch (_) {}
    return Response.json({ error: error.message }, { status: 500 });
  }
}