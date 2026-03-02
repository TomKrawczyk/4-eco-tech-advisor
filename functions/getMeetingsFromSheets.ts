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
  if (!res.ok) return { meetings: [], phoneContacts: [] };
  const data = await res.json();
  const rows = data.values || [];
  if (rows.length < 2) return { meetings: [], phoneContacts: [] };

  const headers = rows[0];

  const intIdx = headers.findIndex(h =>
    h.toLowerCase().includes('zainteresowany') && h.toLowerCase().includes('doradc')
  );
  if (intIdx === -1) return { meetings: [], phoneContacts: [] };

  const nameIdx = headers.findIndex(h => h.toLowerCase().includes('imi') && h.toLowerCase().includes('nazwisko'));
  const phoneIdx = headers.findIndex(h => h.toLowerCase().includes('telefon') || h.toLowerCase().includes('tel'));
  const addressIdx = headers.findIndex(h => h.toLowerCase().trim() === 'adres');
  const dateIdx = headers.findIndex(h => h.toLowerCase().includes('data kontaktu'));
  const agentIdx = headers.findIndex(h => h.toLowerCase().includes('agent dzwoni'));
  const assignedIdx = headers.findIndex(h => h.toLowerCase().includes('komu') && (h.toLowerCase().includes('przypisane') || h.toLowerCase().includes('przekazane')));
  const commentIdx = headers.findIndex(h => h.toLowerCase().includes('komentarz dws') || (h.toLowerCase().includes('komentarz') && h.toLowerCase().includes('dws')));
  let calendarIdx = headers.findIndex(h =>
    h.toLowerCase().includes('data i godzina') ||
    (h.toLowerCase().includes('data') && h.toLowerCase().includes('godzina') && h.toLowerCase().includes('spotkania'))
  );
  if (calendarIdx === -1 && commentIdx > 0) calendarIdx = commentIdx - 1;

  // Mapowanie pytań z nagłówków
  const questions = {
    'Jak rachunki': headers.findIndex(h => h.toLowerCase().includes('jak rachunki')),
    'Ile płaci za prąd': headers.findIndex(h => h.toLowerCase().includes('ile płaci za prąd')),
    'Czy ma foto': headers.findIndex(h => h.toLowerCase().includes('czy ma foto')),
    'Jakie zasady': headers.findIndex(h => h.toLowerCase().includes('jakie zasady')),
    'Ile ma kWp': headers.findIndex(h => h.toLowerCase().includes('ile ma kwp')),
    'Czy ma falownik': headers.findIndex(h => h.toLowerCase().includes('czy ma falownik')),
    'Czy ma Magazyn': headers.findIndex(h => h.toLowerCase().includes('czy ma magazyn')),
    'Pojemność magazynu': headers.findIndex(h => h.toLowerCase().includes('pojemność magazynu') || h.toLowerCase().includes('ile kwh')),
    'Inne urządzenia': headers.findIndex(h => h.toLowerCase().includes('jakieś inne urządzenia')),
    'Czym ogrzewa': headers.findIndex(h => h.toLowerCase().includes('czym ogrzewa')),
    'Ile opłatu na rok': headers.findIndex(h => h.toLowerCase().includes('ile opłatu') && h.toLowerCase().includes('na rok')),
  };

  const buildInterviewData = (row) => {
    const data = {};
    const questionLabels = {
      'Jak rachunki': 'Jak rachunki za prąd/ energię elektryczną?',
      'Ile płaci za prąd': 'Ile płaci za prąd?',
      'Czy ma foto': 'Czy ma foto?',
      'Jakie zasady': 'Jakie zasady?',
      'Ile ma kWp': 'Ile ma kWp instalacji?',
      'Czy ma falownik': 'Czy ma falownik hybrydowy?',
      'Czy ma Magazyn': 'Czy ma Magazyn Energii?',
      'Pojemność magazynu': 'Pojemność magazynu / Ile kWh?',
      'Inne urządzenia': 'Jakieś inne urządzenia pobierające prąd?',
      'Czym ogrzewa': 'Czym ogrzewa dom?',
      'Ile opłatu na rok': 'Ile opłatu zużywa na rok?',
    };

    for (const [key, idx] of Object.entries(questions)) {
      if (idx >= 0) {
        const answer = (row[idx] || '').trim();
        if (answer) {
          data[questionLabels[key]] = answer;
        }
      }
    }
    return Object.keys(data).length > 0 ? data : null;
  };

  const meetings = [];
  const phoneContacts = [];

  for (const row of rows.slice(1)) {
    const intVal = (row[intIdx] || '').trim();
    const name = (nameIdx >= 0 ? row[nameIdx] : '') || '';
    if (!name.trim()) continue;

    const interviewData = buildInterviewData(row);
    const base = {
      client_name: name,
      phone: phoneIdx >= 0 ? (row[phoneIdx] || '') : '',
      address: addressIdx >= 0 ? (row[addressIdx] || '') : '',
      date: dateIdx >= 0 ? (row[dateIdx] || '') : '',
      agent: agentIdx >= 0 ? (row[agentIdx] || '') : (assignedIdx >= 0 ? (row[assignedIdx] || '') : ''),
      assigned: assignedIdx >= 0 ? (row[assignedIdx] || '') : '',
      sheet: sheetTitle,
      status: intVal,
      interview_data: interviewData,
    };

    if (intVal.toLowerCase() === 'spotkanie') {
      meetings.push({
        ...base,
        meeting_calendar: calendarIdx >= 0 ? (row[calendarIdx] || '') : '',
        meeting_note: intVal,
      });
    } else if (intVal.toLowerCase().includes('kontakt') || intVal.toLowerCase().includes('telefon') || intVal.toLowerCase().includes('doradc')) {
      phoneContacts.push({
        ...base,
        contact_calendar: calendarIdx >= 0 ? (row[calendarIdx] || '') : '',
      });
    }
  }

  return { meetings, phoneContacts };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    const allowedUsers = await base44.asServiceRole.entities.AllowedUser.list();
    const ua = allowedUsers.find(a => (a.email || a.data?.email) === user.email);
    const role = ua?.role || ua?.data?.role;

    if (role !== 'admin') {
      return Response.json({ error: 'Forbidden – tylko dla administratora' }, { status: 403 });
    }

    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');
    const allTabs = await getAllSheetTabs(accessToken);
    const results = await Promise.all(allTabs.map(tab => fetchLeadsFromSheet(accessToken, tab)));

    const meetings = results.flatMap(r => r.meetings);
    const phoneContacts = results.flatMap(r => r.phoneContacts);

    return Response.json({
      meetings,
      phoneContacts,
      total: meetings.length,
      totalPhoneContacts: phoneContacts.length,
      refreshed_at: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});