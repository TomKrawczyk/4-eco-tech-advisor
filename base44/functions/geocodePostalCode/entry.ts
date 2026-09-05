import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const POSTAL_RE = /\d{2}-\d{3}/;
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = '4-ECO-Gielda/1.0 (doradca.base44.app)';
const THROTTLE_MS = 1100;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAll(entity) {
  const rows = [];
  let skip = 0;
  const limit = 500;
  while (true) {
    const batch = await entity.list('-created_date', limit, skip);
    if (!batch || batch.length === 0) break;
    rows.push(...batch);
    if (batch.length < limit) break;
    skip += limit;
    if (skip > 50000) break;
  }
  return rows;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const requested = Array.isArray(body?.postal_codes) ? body.postal_codes : [];

    // Unikalne, poprawne kody
    const uniqueCodes = Array.from(
      new Set(requested.map((c) => String(c || '').trim()).filter((c) => POSTAL_RE.test(c)))
    );

    if (uniqueCodes.length === 0) {
      return Response.json({ results: {}, geocoded: 0, cached: 0, not_found: 0 });
    }

    const svc = base44.asServiceRole.entities;
    const cacheRows = await fetchAll(svc.PostalCodeCache);
    const cacheByCode = new Map();
    for (const row of cacheRows) {
      const code = (row.data?.postal_code || row.postal_code || '').trim();
      if (code) cacheByCode.set(code, row);
    }

    const results = {};
    const toGeocode = [];

    for (const code of uniqueCodes) {
      const cached = cacheByCode.get(code);
      if (cached) {
        const data = cached.data || cached;
        if (data.not_found === true) {
          results[code] = null;
        } else if (typeof data.lat === 'number' && typeof data.lon === 'number') {
          results[code] = { lat: data.lat, lon: data.lon, city: data.city || '', display_name: data.display_name || '' };
        } else {
          toGeocode.push(code);
        }
      } else {
        toGeocode.push(code);
      }
    }

    let geocodedCount = 0;
    let notFoundCount = 0;

    for (const code of toGeocode) {
      // Szanuj limit Nominatim: max 1 req/s
      if (geocodedCount > 0 || notFoundCount > 0) await sleep(THROTTLE_MS);

      try {
        const url = `${NOMINATIM_URL}?postalcode=${encodeURIComponent(code)}&country=pl&format=json&limit=1`;
        const resp = await fetch(url, {
          headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        });
        if (!resp.ok) {
          results[code] = null;
          continue;
        }
        const data = await resp.json();
        const hit = Array.isArray(data) && data[0];
        if (!hit || !hit.lat || !hit.lon) {
          results[code] = null;
          notFoundCount += 1;
          await svc.PostalCodeCache.create({
            postal_code: code,
            not_found: true,
            cached_at: new Date().toISOString(),
          }).catch(() => {});
          continue;
        }
        const lat = parseFloat(hit.lat);
        const lon = parseFloat(hit.lon);
        const displayName = String(hit.display_name || '');
        const parts = displayName.split(',').map((s) => s.trim()).filter(Boolean);
        let city = '';
        for (let i = 0; i < parts.length; i += 1) {
          if (/wojew[oó]dztwo/i.test(parts[i])) {
            city = parts[i - 1] || '';
            break;
          }
        }
        if (!city) city = parts[1] || parts[0] || '';
        results[code] = { lat, lon, city, display_name: displayName };
        geocodedCount += 1;
        await svc.PostalCodeCache.create({
          postal_code: code,
          lat,
          lon,
          city,
          display_name: displayName,
          not_found: false,
          cached_at: new Date().toISOString(),
        }).catch(() => {});
      } catch (_e) {
        results[code] = null;
      }
    }

    return Response.json({
      results,
      geocoded: geocodedCount,
      cached: uniqueCodes.length - toGeocode.length,
      not_found: notFoundCount,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}