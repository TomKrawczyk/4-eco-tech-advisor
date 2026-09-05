import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  POSTAL_RE, THROTTLE_MS, sleep, fetchAll, geocodeOne,
} from '../../shared/gieldaShared.ts';

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const requested = Array.isArray(body?.postal_codes) ? body.postal_codes : [];

    const uniqueCodes = Array.from(
      new Set(requested.map((c: any) => String(c || '').trim()).filter((c: string) => POSTAL_RE.test(c)))
    );

    if (uniqueCodes.length === 0) {
      return Response.json({ results: {}, geocoded: 0, cached: 0, not_found: 0 });
    }

    const svc = base44.asServiceRole.entities;
    const cacheRows = await fetchAll(svc.PostalCodeCache);
    const cacheByCode = new Map<string, any>();
    for (const row of cacheRows) {
      const code = (row.data?.postal_code || row.postal_code || '').trim();
      if (code) cacheByCode.set(code, row.data || row);
    }

    const results: Record<string, any> = {};
    const toGeocode: string[] = [];

    for (const code of uniqueCodes) {
      const cached = cacheByCode.get(code);
      if (cached) {
        if (cached.not_found === true) {
          results[code] = null;
        } else if (typeof cached.lat === 'number' && typeof cached.lon === 'number') {
          results[code] = { lat: cached.lat, lon: cached.lon, city: cached.city || '', display_name: cached.display_name || '' };
        } else {
          toGeocode.push(code);
        }
      } else {
        toGeocode.push(code);
      }
    }

    let geocodedCount = 0;
    let notFoundCount = 0;

    for (let i = 0; i < toGeocode.length; i += 1) {
      if (i > 0) await sleep(THROTTLE_MS);
      const code = toGeocode[i];
      try {
        const hit = await geocodeOne(code);
        if (!hit) {
          results[code] = null;
          notFoundCount += 1;
          await svc.PostalCodeCache.create({
            postal_code: code, not_found: true, cached_at: new Date().toISOString(),
          }).catch(() => {});
          continue;
        }
        results[code] = { lat: hit.lat, lon: hit.lon, city: hit.city, display_name: hit.display_name };
        geocodedCount += 1;
        await svc.PostalCodeCache.create({
          postal_code: code, lat: hit.lat, lon: hit.lon, city: hit.city, display_name: hit.display_name,
          not_found: false, cached_at: new Date().toISOString(),
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