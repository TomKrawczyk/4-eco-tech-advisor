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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Sprawdź czy to wywołanie schedulowane (bez użytkownika) czy przez frontend
    const isAuthenticated = await base44.auth.isAuthenticated();

    if (isAuthenticated) {
      // Wywołanie przez frontend – sprawdź rolę z AllowedUser
      const user = await base44.auth.me();
      const allowedUsers = await base44.asServiceRole.entities.AllowedUser.list();
      const ua = allowedUsers.find(a => (a.email || a.data?.email) === user.email);
      const role = ua?.role || ua?.data?.role;

      if (role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    // Jeśli brak sesji użytkownika – wywołanie schedulowane, dozwolone

    const spreadsheetId = Deno.env.get('GOOGLE_SHEETS_SPREADSHEET_ID');
    if (!spreadsheetId) {
      return Response.json({ error: 'Brak GOOGLE_SHEETS_SPREADSHEET_ID' }, { status: 500 });
    }

    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');
    const meetings = await fetchMeetingsFromSheets(accessToken, spreadsheetId);

    // Zapisz do cache w bazie (nadpisz poprzednie dane)
    const existing = await base44.asServiceRole.entities.MeetingsCache.list();
    if (existing.length > 0) {
      await base44.asServiceRole.entities.MeetingsCache.update(existing[0].id, {
        data: meetings,
        refreshed_at: new Date().toISOString()
      });
    } else {
      await base44.asServiceRole.entities.MeetingsCache.create({
        data: meetings,
        refreshed_at: new Date().toISOString()
      });
    }

    return Response.json({ meetings, refreshed_at: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});