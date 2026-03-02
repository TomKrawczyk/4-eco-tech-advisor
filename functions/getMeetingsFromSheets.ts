import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const SPREADSHEET_ID = '19aramNGcpY7ssEcpX34KPI5qmQUWQWVgAF-XC0WiKH8';

async function getAllSheetTabs(accessToken) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?includeGridData=false`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return [];
  const meta = await res.json();
  return meta.sheets.map(s => s.properties.title);
}

async function fetchLeadsFromSheet(accessToken, sheetTitle) {
  const range = `'${sheetTitle}'!A1:Z3000`;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  const rows = data.values || [];
  if (rows.length < 2) return [];

  const headers = rows[0];

  // Znajdź indeks kolumny "Zainteresowany rozmową z doradcą?"
  const intIdx = headers.findIndex(h =>
    h.toLowerCase().includes('zainteresowany') && h.toLowerCase().includes('doradc')
  );
  if (intIdx === -1) return [];

  // Znajdź pozostałe kolumny
  const nameIdx = headers.findIndex(h => h.toLowerCase().includes('imi') && h.toLowerCase().includes('nazwisko'));
  const phoneIdx = headers.findIndex(h => h.toLowerCase().includes('telefon') || h.toLowerCase().includes('tel'));
  const addressIdx = headers.findIndex(h => h.toLowerCase().trim() === 'adres');
  const dateIdx = headers.findIndex(h => h.toLowerCase().includes('data kontaktu'));
  const agentIdx = headers.findIndex(h => h.toLowerCase().includes('agent dzwoni'));
  const assignedIdx = headers.findIndex(h => h.toLowerCase().includes('komu') && (h.toLowerCase().includes('przypisane') || h.toLowerCase().includes('przekazane')));
  
  const commentIdx = headers.findIndex(h => h.toLowerCase().includes('komentarz dws') || (h.toLowerCase().includes('komentarz') && h.toLowerCase().includes('dws')));
  // Szukaj kolumny "Data i godzina spotkania" gdziekolwiek w nagłówkach
  let calendarIdx = headers.findIndex(h =>
    h.toLowerCase().includes('data i godzina') ||
    h.toLowerCase().includes('data') && h.toLowerCase().includes('godzina') && h.toLowerCase().includes('spotkania')
  );
  // Fallback: kolumna bezpośrednio przed "Komentarz DWS"
  if (calendarIdx === -1 && commentIdx > 0) calendarIdx = commentIdx - 1;

  const leads = [];
  for (const row of rows.slice(1)) {
    const intVal = (row[intIdx] || '').trim();
    // Filtruj tylko wiersze z "Spotkanie"
    if (intVal.toLowerCase() !== 'spotkanie') continue;
    // Pomiń puste wiersze
    const name = (nameIdx >= 0 ? row[nameIdx] : '') || '';
    if (!name.trim()) continue;

    leads.push({
      client_name: name,
      phone: phoneIdx >= 0 ? (row[phoneIdx] || '') : '',
      address: addressIdx >= 0 ? (row[addressIdx] || '') : '',
      date: dateIdx >= 0 ? (row[dateIdx] || '') : '',
      agent: agentIdx >= 0 ? (row[agentIdx] || '') : (assignedIdx >= 0 ? (row[assignedIdx] || '') : ''),
      assigned: assignedIdx >= 0 ? (row[assignedIdx] || '') : '',
      meeting_calendar: calendarIdx >= 0 ? (row[calendarIdx] || '') : '',
      meeting_note: intVal,
      sheet: sheetTitle,
      status: 'Spotkanie',
    });
  }
  return leads;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Sprawdź rolę w AllowedUser
    const allowedUsers = await base44.asServiceRole.entities.AllowedUser.list();
    const ua = allowedUsers.find(a => (a.email || a.data?.email) === user.email);
    const role = ua?.role || ua?.data?.role;

    if (role !== 'admin') {
      return Response.json({ error: 'Forbidden – tylko dla administratora' }, { status: 403 });
    }

    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');

    // Pobierz wszystkie zakładki dynamicznie
    const allTabs = await getAllSheetTabs(accessToken);

    // Pobierz dane równolegle ze wszystkich zakładek
    const results = await Promise.all(
      allTabs.map(tab => fetchLeadsFromSheet(accessToken, tab))
    );

    const meetings = results.flat();

    return Response.json({
      meetings,
      total: meetings.length,
      refreshed_at: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});