import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');
    const spreadsheetId = Deno.env.get('GOOGLE_SHEETS_SPREADSHEET_ID');

    if (!spreadsheetId) {
      return Response.json({ error: 'Brak GOOGLE_SHEETS_SPREADSHEET_ID' }, { status: 500 });
    }

    // Fetch sheet data – domyślnie zakładka "Spotkania" lub pierwszy arkusz
    // Zmień nazwę arkusza poniżej gdy poznasz strukturę
    const sheetName = 'Spotkania';
    const range = `${sheetName}!A1:Z1000`;

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: `Sheets API error: ${err}` }, { status: 500 });
    }

    const data = await res.json();
    const rows = data.values || [];

    if (rows.length < 2) {
      return Response.json({ meetings: [] });
    }

    const headers = rows[0].map(h => String(h).trim().toLowerCase());
    const meetings = rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] || '';
      });

      // Normalizuj typowe nazwy kolumn na ustandaryzowane klucze UI
      return {
        client_name: obj['klient'] || obj['imię i nazwisko'] || obj['imie'] || obj['client'] || obj['nazwa'] || '',
        date: obj['data'] || obj['date'] || '',
        time: obj['godzina'] || obj['czas'] || obj['time'] || '',
        address: obj['adres'] || obj['address'] || '',
        phone: obj['telefon'] || obj['tel'] || obj['phone'] || '',
        agent: obj['handlowiec'] || obj['agent'] || obj['doradca'] || '',
        status: obj['status'] || '',
        notes: obj['uwagi'] || obj['notatki'] || obj['notes'] || '',
        ...obj // zachowaj oryginalne dane
      };
    });

    return Response.json({ meetings });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});