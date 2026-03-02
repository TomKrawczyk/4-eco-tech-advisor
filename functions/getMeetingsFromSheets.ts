import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Wszystkie zakładki które mają być przeszukiwane
const SHEET_TABS = [
  "Kujawsko-pomorskie",
  "Świętokrzyskie",
  "Podkarpackie",
  "Podkarpackie - 2",
  "Pomorskie",
  "Pomorskie - 2",
  "Zachodniopomorskie",
  "Kopia arkusza Zachodniopomorskie",
  "Lubelskie",
  "Mazowieckie",
  "Facebook",
  "Spółdzielnie mieszkaniowe",
  "Deweloperzy",
  "Agroturystyka",
];

// Dodaj dynamicznie pozostałe zakładki przy pierwszym uruchomieniu
async function getAllSheetTabs(accessToken, spreadsheetId) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?includeGridData=false`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return SHEET_TABS;
  const meta = await res.json();
  return meta.sheets.map(s => s.properties.title);
}

function normalizeRow(headers, row, sheetTitle) {
  const obj = {};
  headers.forEach((h, i) => { obj[h.trim()] = (row[i] || '').trim(); });

  // Znajdź kolumnę "zainteresowany"
  const interestedKey = Object.keys(obj).find(k =>
    k.toLowerCase().includes('zainteresowany') && k.toLowerCase().includes('doradc')
  );
  const interested = interestedKey ? obj[interestedKey] : '';

  // Znajdź kolumnę z imieniem i nazwiskiem
  const nameKey = Object.keys(obj).find(k => k.toLowerCase().includes('imi') && k.toLowerCase().includes('nazwisko')) || 'Imię i nazwisko';
  // Telefon
  const phoneKey = Object.keys(obj).find(k => k.toLowerCase().includes('telefon') || k.toLowerCase().includes('tel.')) || 'Nr telefonu';
  // Adres
  const addressKey = Object.keys(obj).find(k => k.toLowerCase() === 'adres') || 'Adres';
  // Data kontaktu
  const dateKey = Object.keys(obj).find(k => k.toLowerCase().includes('data kontaktu')) || 'Data kontaktu';
  // Data spotkania (z pola "zainteresowany" może być wpisana data)
  const meetingNoteKey = Object.keys(obj).find(k => k.toLowerCase().includes('zainteresowany') && k.toLowerCase().includes('doradc'));
  // Komu przypisane
  const agentKey = Object.keys(obj).find(k => k.toLowerCase().includes('komu') && (k.toLowerCase().includes('przypisane') || k.toLowerCase().includes('przekazane')));
  // Agent dzwoniący
  const callerKey = Object.keys(obj).find(k => k.toLowerCase().includes('agent'));

  return {
    client_name: obj[nameKey] || '',
    phone: obj[phoneKey] || '',
    address: obj[addressKey] || '',
    date: obj[dateKey] || '',
    meeting_note: meetingNoteKey ? obj[meetingNoteKey] : '',
    agent: obj[agentKey] || obj[callerKey] || '',
    status: 'Spotkanie',
    sheet: sheetTitle,
    raw: obj,
    interested
  };
}

async function fetchLeadsFromSheet(accessToken, spreadsheetId, sheetTitle) {
  const range = `'${sheetTitle}'!A1:Z2000`;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  const rows = data.values || [];
  if (rows.length < 2) return [];

  const headers = rows[0];
  const leads = [];

  for (const row of rows.slice(1)) {
    const normalized = normalizeRow(headers, row, sheetTitle);
    // Filtruj tylko te z wartością "Spotkanie" w kolumnie zainteresowany
    if (normalized.interested.toLowerCase().includes('spotkanie')) {
      leads.push(normalized);
    }
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

    const spreadsheetId = Deno.env.get('GOOGLE_SHEETS_SPREADSHEET_ID');
    if (!spreadsheetId) {
      return Response.json({ error: 'Brak GOOGLE_SHEETS_SPREADSHEET_ID' }, { status: 500 });
    }

    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');

    // Pobierz wszystkie zakładki dynamicznie
    const allTabs = await getAllSheetTabs(accessToken, spreadsheetId);

    // Pobierz dane równolegle ze wszystkich zakładek
    const results = await Promise.all(
      allTabs.map(tab => fetchLeadsFromSheet(accessToken, spreadsheetId, tab))
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