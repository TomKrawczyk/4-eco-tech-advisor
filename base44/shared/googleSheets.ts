// Współdzielone helpery do pracy z Google Sheets — używane przez refreshMeetingsCache
// oraz autoAssignPhoneContacts (i ewentualnie inne funkcje backendowe).
// Zgodnie z wymogiem platformy logika współdzielona między funkcjami żyje w base44/shared,
// a nie w kopiach wewnątrz każdej funkcji.

export const RANGE_SUFFIX = 'A1:Z3000';
export const MAX_BATCH_RANGES = 20;

export function extractSpreadsheetId(value) {
  if (!value) return '19aramNGcpY7ssEcpX34KPI5qmQUWQWVgAF-XC0WiKH8';
  const match = String(value).match(/\/spreadsheets\/d\/([^/]+)/);
  return match ? match[1] : String(value).trim();
}

export function normalizeAccessToken(tokenData) {
  if (typeof tokenData === 'string') return tokenData;
  if (tokenData?.accessToken && typeof tokenData.accessToken === 'string') return tokenData.accessToken;
  if (tokenData?.access_token) return tokenData.access_token;
  if (typeof tokenData === 'object' && tokenData) {
    const firstValue = Object.values(tokenData).find((value) => typeof value === 'string' && value.startsWith('ya29'));
    if (firstValue) return firstValue;
  }
  return '';
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeHeader(value) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

export function extractSheetTitle(range) {
  if (!range) return '';
  if (range.startsWith("'")) {
    const end = range.indexOf("'!");
    if (end > 0) return range.slice(1, end).replace(/''/g, "'");
  }
  return range.split('!')[0];
}

export function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export async function fetchJsonWithRetry(url, options, label) {
  let lastError = `${label}: unknown error`;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const response = await fetch(url, options);
    const rawBody = await response.text();
    const isHtml = rawBody.toLowerCase().includes('<html') || rawBody.toLowerCase().includes('<!doctype html');

    if (response.ok && !isHtml) {
      try {
        return rawBody ? JSON.parse(rawBody) : {};
      } catch (_) {
        lastError = `${label}: invalid JSON response from Google API`;
      }
    } else {
      lastError = isHtml
        ? `${label}: Google zwrócił stronę HTML zamiast danych API (status ${response.status})`
        : `${label}: Google API ${response.status} – ${rawBody.slice(0, 500)}`;
    }

    const retryable = response.status === 429 || response.status >= 500 || isHtml;
    if (attempt < 5 && retryable) {
      await sleep(500 * (2 ** (attempt - 1)));
      continue;
    }

    throw new Error(lastError);
  }
  throw new Error(lastError);
}

export async function getGoogleSheetsAccessToken(base44) {
  const connection = await base44.asServiceRole.connectors.getConnection('googlesheets');
  const token = normalizeAccessToken(connection);
  if (!token || token === 'ya29...' || token.length < 20) {
    throw new Error('Połączenie Google Sheets zwróciło nieprawidłowy token dostępu.');
  }
  return token;
}