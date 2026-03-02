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
  console.log(`[${sheetTitle}] NAGŁÓWKI (${headers.length}):`, headers.map((h, i) => `[${i}] "${h}"`).join(' | '));

  const intIdx = headers.findIndex(h =>
    h.toLowerCase().includes('zainteresowany') && h.toLowerCase().includes('doradc')
  );
  const nameIdx = headers.findIndex(h => h.toLowerCase().includes('imi') && h.toLowerCase().includes('nazwisko'));
  const phoneIdx = headers.findIndex(h => h.toLowerCase().includes('telefon') || h.toLowerCase().includes('tel'));
  const addressIdx = headers.findIndex(h => h.toLowerCase().trim() === 'adres');
  let dateIdx = headers.findIndex(h => h.toLowerCase().includes('data kontaktu'));
  if (dateIdx === -1) {
    dateIdx = headers.findIndex(h => h.toLowerCase().includes('data') && !h.toLowerCase().includes('godzina'));
  }
  
  const agentIdx = headers.findIndex(h => h.toLowerCase().includes('agent dzwoni'));
  const assignedIdx = headers.findIndex(h => h.toLowerCase().includes('komu') && (h.toLowerCase().includes('przypisane') || h.toLowerCase().includes('przekazane')));
  
  let commentIdx = headers.findIndex(h => 
    h.toLowerCase().includes('komentarz') && 
    (h.toLowerCase().includes('dws') || h.toLowerCase().includes('inne') || h.toLowerCase().includes('sprzęty'))
  );
  // Fallback: szukaj kolumny o treści zawierającej słowa z komentarza
  if (commentIdx === -1) {
    commentIdx = headers.findIndex(h => {
      const lower = h.toLowerCase();
      return lower.includes('komentarz') || (lower.includes('uwagi') && !lower.includes('dodatkowe'));
    });
  }

  console.log(`[${sheetTitle}] commentIdx: ${commentIdx}, dateIdx: ${dateIdx}`, commentIdx >= 0 ? `"${headers[commentIdx]}"` : '', dateIdx >= 0 ? `"${headers[dateIdx]}"` : '');
  if (intIdx === -1) return { meetings: [], phoneContacts: [] };
  
  let calendarIdx = headers.findIndex(h =>
    h.toLowerCase().includes('data') && h.toLowerCase().includes('godzina') && h.toLowerCase().includes('spotkania')
  );
  if (calendarIdx === -1) {
    calendarIdx = headers.findIndex(h => h.toLowerCase().includes('godzina'));
  }

  // Mapowanie pytań z nagłówków
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
    if (idx >= 0 && !questions[label]) {
      questions[label] = idx;
    }
  });

  const buildInterviewData = (row) => {
    const data = {};

    for (const [key, idx] of Object.entries(questions)) {
      if (typeof idx === 'number' && idx >= 0) {
        const answer = (row[idx] || '').trim();
        if (answer) {
          data[key] = answer;
        }
      }
    }
    return Object.keys(data).length > 0 ? data : null;
  };

  const meetings = [];
  const phoneContacts = [];
  let meetingsWithData = 0;
  let contactsWithData = 0;

  for (const row of rows.slice(1)) {
    const intVal = (row[intIdx] || '').trim();
    const name = (nameIdx >= 0 ? row[nameIdx] : '') || '';
    if (!name.trim()) continue;

    const interviewData = buildInterviewData(row);
    if (interviewData) {
      if (intVal.toLowerCase() === 'spotkanie') meetingsWithData++;
      else contactsWithData++;
    }
    
    const base = {
      client_name: name,
      phone: phoneIdx >= 0 ? (row[phoneIdx] || '') : '',
      address: addressIdx >= 0 ? (row[addressIdx] || '') : '',
      date: dateIdx >= 0 ? (row[dateIdx] || '') : '',
      agent: agentIdx >= 0 ? (row[agentIdx] || '') : (assignedIdx >= 0 ? (row[assignedIdx] || '') : ''),
      comments: commentIdx >= 0 ? (row[commentIdx] || '') : '',
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
        contact_key: `${sheetTitle}__${name}__${dateIdx >= 0 ? row[dateIdx] : ''}`,
        contact_date: dateIdx >= 0 && row[dateIdx] ? (() => {
          const match = String(row[dateIdx]).match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
          if (match) {
            const [, d, m, y] = match;
            return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          }
          return '';
        })() : '',
      });
    }
  }

  console.log(`[${sheetTitle}] Znalezione pytania:`, Object.keys(questions).map(k => `${k} (kolumna ${questions[k]})`).join(', '));
  console.log(`[${sheetTitle}] Spotkania: ${meetings.length} (z danymi: ${meetingsWithData}), Kontakty: ${phoneContacts.length} (z danymi: ${contactsWithData})`);
  
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