import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function extractSpreadsheetId(value) {
  if (!value) return '19aramNGcpY7ssEcpX34KPI5qmQUWQWVgAF-XC0WiKH8';
  const match = String(value).match(/\/spreadsheets\/d\/([^/]+)/);
  return match ? match[1] : String(value).trim();
}

const SPREADSHEET_ID = extractSpreadsheetId(Deno.env.get('GOOGLE_SHEETS_SPREADSHEET_ID'));

function normalizeAccessToken(tokenData) {
  // getConnection returns { accessToken, connectionConfig }
  if (typeof tokenData === 'string') return tokenData;
  if (tokenData?.accessToken && typeof tokenData.accessToken === 'string') {
    console.log('Extracted accessToken from object');
    return tokenData.accessToken;
  }
  if (tokenData?.access_token) return tokenData.access_token;
  if (typeof tokenData === 'object' && tokenData) {
    const firstValue = Object.values(tokenData).find(v => typeof v === 'string' && v.startsWith('ya29'));
    if (firstValue) {
      console.log('Extracted ya29 token from object values');
      return firstValue;
    }
  }
  console.log('normalizeAccessToken could not extract token');
  return '';
}

async function getGoogleSheetsAccessToken(base44) {
  const connection = await base44.asServiceRole.connectors.getConnection('googlesheets');
  const token = normalizeAccessToken(connection);

  if (!token || token === 'ya29...' || token.length < 20) {
    throw new Error('Połączenie Google Sheets nadal zwraca nieprawidłowy token. Odłącz i połącz konektor Google Sheets ponownie, wybierając konto z dostępem do arkusza.');
  }

  return token;
}

async function getAllSheetTabs(accessToken) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?includeGridData=false`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    const errorText = await res.text();
    console.log(`Google Sheets tabs error ${res.status}: ${errorText}`);
    return [];
  }
  const meta = await res.json();
  const tabs = meta.sheets.map(s => s.properties.title);
  console.log(`Google Sheets spreadsheet ${SPREADSHEET_ID}: ${tabs.length} zakładek`);
  return tabs;
}

async function fetchLeadsFromSheet(accessToken, sheetTitle) {
  const range = `'${sheetTitle}'!A1:Z3000`;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    console.log(`[${sheetTitle}] Google API error ${res.status}: ${await res.text()}`);
    return { meetings: [], phoneContacts: [] };
  }
  const data = await res.json();
  const rows = data.values || [];
  if (rows.length < 2) return { meetings: [], phoneContacts: [] };

  const headers = rows[0];

  // Mapowanie kolumn na podstawie dokładnych nagłówków
  const columnMap = {
    nameIdx: headers.findIndex(h => h.includes('Imię i nazwisko')),
    phoneIdx: headers.findIndex(h =>
      h.includes('Numer telefonu') ||
      h.toLowerCase().includes('telefon') ||
      h.toLowerCase().includes('tel.') ||
      h.toLowerCase() === 'tel' ||
      h.toLowerCase().includes('phone') ||
      h.toLowerCase().includes('kontakt') && h.toLowerCase().includes('nr')
    ),
    addressIdx: headers.findIndex(h => h === 'Adres'),
    dateIdx: headers.findIndex(h => h === 'Data kontaktu'),
    agentIdx: headers.findIndex(h => h === 'Agent dzwoniący'),
    assignedIdx: headers.findIndex(h => h === 'Komu przypisane'),
    commentIdx: (() => {
      // Najpierw szukamy dokładnie 'Komentarz DWS', potem szerzej 'komentarz', potem 'uwagi'/'notatki'
      const exact = headers.findIndex(h => h && h.includes('Komentarz DWS'));
      if (exact >= 0) return exact;
      const broad = headers.findIndex(h => h && h.toLowerCase().includes('komentarz'));
      if (broad >= 0) return broad;
      return headers.findIndex(h => h && (h.toLowerCase().includes('uwagi') || h.toLowerCase().includes('notatki')));
    })(),
    intIdx: headers.findIndex(h => h.includes('Zainteresowany rozmową z doradcą')),
    calendarIdx: headers.findIndex(h => h.includes('Data i godzina spotkania')),
  };

  const { nameIdx, phoneIdx, addressIdx, dateIdx, agentIdx, assignedIdx, commentIdx, intIdx, calendarIdx } = columnMap;

  console.log(`[${sheetTitle}] Mapowanie kolumn:`, columnMap);

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
    } else if (intVal.toLowerCase().includes('kontakt') || intVal.toLowerCase().includes('telefon') || intVal.toLowerCase().includes('doradc') || intVal.toLowerCase() === 'dws') {
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

    console.log(`User: ${user.email}, Role: ${role}, UA:`, ua);

    const isLeaderOrAdmin = role === 'admin' || role === 'group_leader' || role === 'team_leader';
    const isAdvisor = role === 'advisor' || role === 'user';

    if (!isLeaderOrAdmin && !isAdvisor) {
      return Response.json({ error: 'Forbidden – brak uprawnień' }, { status: 403 });
    }

    console.log(`User has access. isLeaderOrAdmin=${isLeaderOrAdmin}, isAdvisor=${isAdvisor}`);

    const accessToken = await getGoogleSheetsAccessToken(base44);
    const allTabs = await getAllSheetTabs(accessToken);

    // Pobierz konfigurację arkuszy – wyklucz wyłączone
    const sheetMappings = await base44.asServiceRole.entities.SheetGroupMapping.list();
    const activeTabs = allTabs.filter(tab => {
      const mapping = sheetMappings.find(m => (m.sheet_name || m.data?.sheet_name) === tab);
      const isActive = mapping?.is_active ?? mapping?.data?.is_active;
      return !mapping || isActive !== false;
    });

    console.log(`Aktywne zakładki do pobrania: ${activeTabs.length}`);

    const results = await Promise.all(activeTabs.map(tab => fetchLeadsFromSheet(accessToken, tab)));

    let meetings = results.flatMap(r => r.meetings);
    let phoneContacts = results.flatMap(r => r.phoneContacts);

    if (isAdvisor) {
      const assignments = await base44.asServiceRole.entities.MeetingAssignment.filter({ assigned_user_email: user.email });
      const assignedKeys = new Set(assignments.map(a => a.meeting_key));
      meetings = meetings.filter(m => assignedKeys.has(`${m.sheet}__${m.client_name}__${m.meeting_calendar}`));
      phoneContacts = [];
    }

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