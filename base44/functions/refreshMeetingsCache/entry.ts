import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function fetchMeetingsFromSheets(accessToken, spreadsheetId) {
  const sheetName = 'Spotkania';
  const range = `${sheetName}!A1:Z1000`;

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sheets API error: ${err}`);
  }

  const data = await res.json();
  const rows = data.values || [];

  if (rows.length < 2) return [];

  const headers = rows[0].map(h => String(h).trim().toLowerCase());
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] || ''; });

    return {
      client_name: obj['klient'] || obj['imię i nazwisko'] || obj['imie'] || obj['client'] || obj['nazwa'] || '',
      date: obj['data'] || obj['date'] || '',
      time: obj['godzina'] || obj['czas'] || obj['time'] || '',
      address: obj['adres'] || obj['address'] || '',
      phone: obj['telefon'] || obj['tel'] || obj['phone'] || '',
      agent: obj['handlowiec'] || obj['agent'] || obj['doradca'] || '',
      status: obj['status'] || '',
      notes: obj['uwagi'] || obj['notatki'] || obj['notes'] || '',
      ...obj
    };
  });
}

// Funkcja wywoływana przez scheduler co 5 minut
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const spreadsheetId = Deno.env.get('GOOGLE_SHEETS_SPREADSHEET_ID');
    if (!spreadsheetId) {
      return Response.json({ error: 'Brak GOOGLE_SHEETS_SPREADSHEET_ID' }, { status: 500 });
    }

    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');
    const meetings = await fetchMeetingsFromSheets(accessToken, spreadsheetId);

    console.log(`[refreshMeetingsCache] Pobrano ${meetings.length} spotkań z arkusza`);

    return Response.json({ success: true, count: meetings.length, refreshed_at: new Date().toISOString() });
  } catch (error) {
    console.error('[refreshMeetingsCache] Błąd:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});