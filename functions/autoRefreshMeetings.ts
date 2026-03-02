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

  const meetings = [];
  const phoneContacts = [];

  for (const row of rows.slice(1)) {
    const intVal = (row[intIdx] || '').trim();
    const name = (nameIdx >= 0 ? row[nameIdx] : '') || '';
    if (!name.trim()) continue;

    const base = {
      client_name: name,
      phone: phoneIdx >= 0 ? (row[phoneIdx] || '') : '',
      address: addressIdx >= 0 ? (row[addressIdx] || '') : '',
      date: dateIdx >= 0 ? (row[dateIdx] || '') : '',
      agent: agentIdx >= 0 ? (row[agentIdx] || '') : (assignedIdx >= 0 ? (row[assignedIdx] || '') : ''),
      sheet: sheetTitle,
      status: intVal,
    };

    if (intVal.toLowerCase() === 'spotkanie') {
      meetings.push({
        ...base,
        meeting_calendar: calendarIdx >= 0 ? (row[calendarIdx] || '') : '',
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

function parseMeetingDate(str) {
  if (!str) return null;
  const match = str.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (match) {
    const [, d, m, y] = match;
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    if (!isNaN(date.getTime())) return date;
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed;
  return null;
}

function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');

    const allTabs = await getAllSheetTabs(accessToken);
    const results = await Promise.all(allTabs.map(tab => fetchLeadsFromSheet(accessToken, tab)));

    const meetings = results.flatMap(r => r.meetings);
    const phoneContacts = results.flatMap(r => r.phoneContacts);

    // Sync MeetingAssignment — utwórz nowe jeśli jeszcze nie istnieją
    const existingAssignments = await base44.asServiceRole.entities.MeetingAssignment.list();
    const existingKeys = new Set(existingAssignments.map(a => a.meeting_key));

    let newMeetings = 0;
    for (const m of meetings) {
      const key = `${m.sheet}__${m.client_name}__${m.meeting_calendar}`;
      if (!existingKeys.has(key)) {
        const d = parseMeetingDate(m.meeting_calendar);
        await base44.asServiceRole.entities.MeetingAssignment.create({
          meeting_key: key,
          sheet: m.sheet,
          client_name: m.client_name,
          meeting_calendar: m.meeting_calendar,
          meeting_date: d ? formatDate(d) : '',
        });
        newMeetings++;
      }
    }

    // Sync PhoneContact — utwórz nowe jeśli jeszcze nie istnieją
    const existingContacts = await base44.asServiceRole.entities.PhoneContact.list();
    const existingContactKeys = new Set(existingContacts.map(c => c.contact_key));

    let newContacts = 0;
    for (const c of phoneContacts) {
      const key = `${c.sheet}__${c.client_name}__${c.date}`;
      if (!existingContactKeys.has(key)) {
        const d = parseMeetingDate(c.contact_calendar || c.date);
        await base44.asServiceRole.entities.PhoneContact.create({
          contact_key: key,
          sheet: c.sheet,
          client_name: c.client_name,
          phone: c.phone,
          address: c.address,
          date: c.date,
          agent: c.agent,
          contact_calendar: c.contact_calendar,
          status: c.status,
          contact_date: d ? formatDate(d) : '',
        });
        newContacts++;
      }
    }

    console.log(`[autoRefreshMeetings] Nowe spotkania: ${newMeetings}, nowe kontakty: ${newContacts}`);

    return Response.json({
      success: true,
      new_meetings: newMeetings,
      new_contacts: newContacts,
      refreshed_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('[autoRefreshMeetings] Błąd:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});