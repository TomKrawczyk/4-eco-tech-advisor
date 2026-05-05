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

  const questions = {};
  const questionMappings = [
    ['Jak rachunki za prąd', h => h.toLowerCase().includes('jak rachunki')],
    ['Ile płaci za prąd', h => h.toLowerCase().includes('ile płaci') && h.toLowerCase().includes('prąd')],
    ['Czy ma foto', h => h.toLowerCase().includes('czy') && h.toLowerCase().includes('foto')],
    ['Jakie zasady', h => h.toLowerCase().includes('jakie') && h.toLowerCase().includes('zasady')],
    ['Ile ma kWp instalacji', h => h.toLowerCase().includes('kwp')],
    ['Czy ma falownik hybrydowy', h => h.toLowerCase().includes('falownik')],
    ['Czy ma Magazyn Energii', h => h.toLowerCase().includes('magazyn') && (h.toLowerCase().includes('energia') || h.toLowerCase().includes('magazyn'))],
    ['Pojemność magazynu', h => h.toLowerCase().includes('pojemność') || (h.toLowerCase().includes('kwh') && !h.toLowerCase().includes('roczna'))],
    ['Inne urządzenia', h => h.toLowerCase().includes('inne') && h.toLowerCase().includes('urządzenia')],
    ['Czym ogrzewa dom', h => h.toLowerCase().includes('ogrzewa')],
    ['Ile opłatu na rok', h => h.toLowerCase().includes('opłatu') && h.toLowerCase().includes('rok')],
    ['Wielkość instalacji', h => h.toLowerCase().includes('wielkość') && h.toLowerCase().includes('instalacji')],
    ['Wielkość instalacji w umowie', h => h.toLowerCase().includes('wielkość') && h.toLowerCase().includes('umowie')],
  ];
  questionMappings.forEach(([label, matcher]) => {
    const idx = headers.findIndex(matcher);
    if (idx >= 0 && !questions[label]) questions[label] = idx;
  });

  const buildInterviewData = (row) => {
    const data = {};
    for (const [key, idx] of Object.entries(questions)) {
      const answer = (row[idx] || '').trim();
      if (answer) data[key] = answer;
    }
    return Object.keys(data).length > 0 ? data : null;
  };

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
      comments: commentIdx >= 0 ? (row[commentIdx] || '') : '',
      sheet: sheetTitle,
      status: intVal,
      interview_data: buildInterviewData(row),
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');

    const allTabs = await getAllSheetTabs(accessToken);
    const sheetMappings = await base44.asServiceRole.entities.SheetGroupMapping.list();
    const activeTabs = allTabs.filter(tab => {
      const mapping = sheetMappings.find(m => m.sheet_name === tab);
      return !mapping || mapping.is_active !== false;
    });
    const results = [];
    for (const tab of activeTabs) {
      results.push(await fetchLeadsFromSheet(accessToken, tab));
      await sleep(500);
    }

    const meetings = results.flatMap(r => r.meetings);
    const phoneContacts = results.flatMap(r => r.phoneContacts);

    // Sync MeetingAssignment — utwórz nowe lub zaktualizuj adres/telefon
    const existingAssignments = await base44.asServiceRole.entities.MeetingAssignment.list();
    const existingMap = {};
    for (const a of existingAssignments) {
      existingMap[a.meeting_key] = a;
    }

    let newMeetings = 0;
    let updatedMeetings = 0;
    const MAX_UPDATES_PER_RUN = 25;
    for (const m of meetings) {
      if (updatedMeetings >= MAX_UPDATES_PER_RUN) break;
      const key = `${m.sheet}__${m.client_name}__${m.meeting_calendar}`;
      const existing = existingMap[key];
      if (!existing) {
        const d = parseMeetingDate(m.meeting_calendar);
        await base44.asServiceRole.entities.MeetingAssignment.create({
          meeting_key: key,
          sheet: m.sheet,
          client_name: m.client_name,
          client_phone: m.phone || "",
          client_address: m.address || "",
          meeting_calendar: m.meeting_calendar,
          meeting_date: d ? formatDate(d) : '',
          agent: m.agent || "",
          comments: m.comments || "",
          interview_data: m.interview_data || {},
        });
        newMeetings++;
      } else {
        // Uzupełnij brakujące dane kontaktowe i szczegóły widoczne dla doradcy
        const patch = {};
        if (m.address && !existing.client_address) patch.client_address = m.address;
        if (m.phone && !existing.client_phone) patch.client_phone = m.phone;
        if (m.agent && !existing.agent) patch.agent = m.agent;
        if (m.comments && !existing.comments) patch.comments = m.comments;
        if (m.interview_data && Object.keys(m.interview_data).length > 0 && (!existing.interview_data || Object.keys(existing.interview_data).length === 0)) patch.interview_data = m.interview_data;
        if (Object.keys(patch).length === 0) continue;
        await base44.asServiceRole.entities.MeetingAssignment.update(existing.id, patch);
        await sleep(300);
        // Zaktualizuj powiązany CalendarEvent
        if (patch.client_address) {
          const eventsToUpdate = await base44.asServiceRole.entities.CalendarEvent.filter({ meeting_assignment_id: key });
          for (const ev of eventsToUpdate) {
            if (!ev.location) await base44.asServiceRole.entities.CalendarEvent.update(ev.id, { location: patch.client_address });
          }
        }
        updatedMeetings++;
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
          comments: c.comments || "",
          interview_data: c.interview_data || {},
          contact_date: d ? formatDate(d) : '',
        });
        newContacts++;
      }
    }

    console.log(`[autoRefreshMeetings] Nowe spotkania: ${newMeetings}, zaktualizowane: ${updatedMeetings}, nowe kontakty: ${newContacts}`);

    return Response.json({
      success: true,
      new_meetings: newMeetings,
      updated_meetings: updatedMeetings,
      new_contacts: newContacts,
      refreshed_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('[autoRefreshMeetings] Błąd:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});