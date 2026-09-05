// Współdzielone helpery dla funkcji Giełdy: paginacja, geokodowanie Nominatim, parsowanie kodów.

export const POSTAL_RE = /\d{2}-\d{3}/;
export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
export const USER_AGENT = '4-ECO-Gielda/1.0 (doradca.base44.app)';
export const THROTTLE_MS = 1100;

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Paginowane pobieranie wszystkich rekordów encji (service role).
export async function fetchAll(entity: any): Promise<any[]> {
  const rows: any[] = [];
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

export function extractPostalCode(...fields: any[]): string {
  for (const field of fields) {
    if (!field) continue;
    const m = String(field).match(POSTAL_RE);
    if (m) return m[0];
  }
  return '';
}

export function extractCity(address: any, geoCity?: string): string {
  if (geoCity) return geoCity;
  if (!address) return '';
  const text = String(address);
  const idx = text.search(POSTAL_RE);
  if (idx >= 0) {
    const after = text.slice(idx).replace(POSTAL_RE, '').trim();
    return after.split(/[,;|]/)[0].trim() || '';
  }
  return text.split(/[,;|]/)[0].trim();
}

// Pojedyncze zapytanie Nominatim dla kodu pocztowego; zwraca {lat,lon,city,display_name} | null.
export async function geocodeOne(code: string): Promise<{ lat: number; lon: number; city: string; display_name: string } | null> {
  const url = `${NOMINATIM_URL}?postalcode=${encodeURIComponent(code)}&country=pl&format=json&limit=1`;
  const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
  if (!resp.ok) return null;
  const data = await resp.json();
  const hit = Array.isArray(data) && data[0];
  if (!hit || !hit.lat || !hit.lon) return null;
  const lat = parseFloat(hit.lat);
  const lon = parseFloat(hit.lon);
  const displayName = String(hit.display_name || '');
  const parts = displayName.split(',').map((s: string) => s.trim()).filter(Boolean);
  let city = '';
  for (let p = 0; p < parts.length; p += 1) {
    if (/wojew[oó]dztwo/i.test(parts[p])) { city = parts[p - 1] || ''; break; }
  }
  if (!city) city = parts[1] || parts[0] || '';
  return { lat, lon, city, display_name: displayName };
}