import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const RANGE_SUFFIX = 'A1:Z3000';
const MAX_BATCH_RANGES = 20;

function extractSpreadsheetId(value) {
  if (!value) return '19aramNGcpY7ssEcpX34KPI5qmQUWQWVgAF-XC0WiKH8';
  const match = String(value).match(/\/spreadsheets\/d\/([^/]+)/);
  return match ? match[1] : String(value).trim();
}

function normalizeAccessToken(tokenData) {
  if (typeof tokenData === 'string') return tokenData;
  if (tokenData?.accessToken && typeof tokenData.accessToken === 'string') return tokenData.accessToken;
  if (tokenData?.access_token) return tokenData.access_token;
  if (typeof tokenData === 'object' && tokenData) {
    const firstValue = Object.values(tokenData).find((value) => typeof value === 'string' && value.startsWith('ya29'));
    if (firstValue) return firstValue;
  }
  return '';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeHeader(value) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function extractSheetTitle(range) {
  if (!range) return '';
  if (range.startsWith("'")) {
    const end = range.indexOf("'!");
    if (end > 0) return range.slice(1, end).replace(/''/g, "'");
  }
  return range.split('!')[0];
}

async function fetchJsonWithRetry(url, options, label) {
  let lastError = `${label}: unknown error`;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const response = await fetch(url, options);
    const rawBody = await response.text();
    const isHtml = rawBody.toLowerCase().includes('<html') || rawBody.toLowerCase().includes('<!doctype html');

    if (response.ok && !isHtml) {
      try {
        return rawBody ? JSON.parse(rawBody) : {};
      } catch (_) {
        lastError = `${label}: invalid JSON response from Google API`;
      }
    } else {
      lastError = isHtml
        ? `${label}: Google zwrócił stronę HTML zamiast danych API (status ${response.status})`
        : `${label}: Google API ${response.status} – ${rawBody.slice(0, 500)}`;
    }

    const retryable = response.status === 429 || response.status >= 500 || isHtml;
    if (attempt < 5 && retryable) {
      await sleep(500 * (2 ** (attempt - 1)));
      continue;
    }

    throw new Error(lastError);
  }
  throw new Error(lastError);
}

async function getGoogleSheetsAccessToken(base44) {
  const connection = await base44.asServiceRole.connectors.getConnection('googlesheets');
  const token = normalizeAccessToken(connection);
  if (!token || token === 'ya29...' || token.length < 20) {
    throw new Error('Połączenie Google Sheets zwróciło nieprawidłowy token dostępu.');
  }
  return token;
}

async function getAllSheetTabs(accessToken, spreadsheetId, sheetMappings) {
  const mappedTabs = (sheetMappings || [])
    .filter((item) => {
      const isActive = item?.is_active ?? item?.data?.is_active;
      return isActive !== false;
    })
    .map((item) => item?.sheet_name || item?.data?.sheet_name)
    .filter(Boolean);

  if (mappedTabs.length > 0) {
    return [...new Set(mappedTabs)];
  }

  const data = await fetchJsonWithRetry(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?includeGridData=false`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    'spreadsheet metadata'
  );
  return (data.sheets || []).map((sheet) => sheet.properties?.title).filter(Boolean);
}

function parseSheetRows(sheetTitle, rows) {
  if (!rows || rows.length < 2) return { meetings: [], phoneContacts: [] };

  const headers = rows[0].map(normalizeHeader);
  const headersLower = headers.map((header) => header.toLowerCase());
  const findHeader = (predicate) => headersLower.findIndex(predicate);

  const columnMap = {
    nameIdx: findHeader((header) => header.includes('imię i nazwisko') || (header.includes('imię') && header.includes('nazwisko'))),
    phoneIdx: findHeader((header) =>
      header.includes('numer telefonu') ||
      header.includes('telefon') ||
      header.includes('tel.') ||
      header === 'tel' ||
      header.includes('phone') ||
      (header.includes('kontakt') && header.includes('nr'))
    ),
    addressIdx: findHeader((header) => header === 'adres'),
    dateIdx: findHeader((header) => header === 'data kontaktu'),
    agentIdx: findHeader((header) => header === 'agent dzwoniący' || header.startsWith('agent ')),
    assignedIdx: findHeader((header) => header === 'komu przypisane' || header.includes('komu przypisane')),
    commentIdx: (() => {
      const exact = findHeader((header) => header.includes('komentarz dws'));
      if (exact >= 0) return exact;
      const broad = findHeader((header) => header.includes('komentarz'));
      if (broad >= 0) return broad;
      return findHeader((header) => header.includes('uwagi') || header.includes('notatki'));
    })(),
    intIdx: findHeader((header) => header.includes('zainteresowany rozmową z doradcą') || (header.includes('zainteresowany') && header.includes('doradc'))),
    calendarIdx: findHeader((header) => header.includes('data i godzina spotkania') || (header.includes('data') && header.includes('godzina') && header.includes('spotkan'))),
  };

  const { nameIdx, phoneIdx, addressIdx, dateIdx, agentIdx, assignedIdx, commentIdx, intIdx, calendarIdx } = columnMap;

  const questionMappings = [
    ['Jak rachunki za prąd', (header) => header.toLowerCase().includes('jak rachunki')],
    ['Ile płaci za prąd', (header) => header.toLowerCase().includes('ile płaci') && header.toLowerCase().includes('prąd')],
    ['Czy ma foto', (header) => header.toLowerCase().includes('czy') && header.toLowerCase().includes('foto')],
    ['Jakie zasady', (header) => header.toLowerCase().includes('jakie') && header.toLowerCase().includes('zasady')],
    ['Ile ma kWp instalacji', (header) => header.toLowerCase().includes('kwp')],
    ['Czy ma falownik hybrydowy', (header) => header.toLowerCase().includes('falownik')],
    ['Czy ma Magazyn Energii', (header) => header.toLowerCase().includes('magazyn') && (header.toLowerCase().includes('energia') || header.toLowerCase().includes('magazyn'))],
    ['Pojemność magazynu', (header) => header.toLowerCase().includes('pojemność') || (header.toLowerCase().includes('kwh') && !header.toLowerCase().includes('roczna'))],
    ['Inne urządzenia', (header) => header.toLowerCase().includes('inne') && header.toLowerCase().includes('urządzenia')],
    ['Czym ogrzewa dom', (header) => header.toLowerCase().includes('ogrzewa')],
    ['Ile opłatu na rok', (header) => header.toLowerCase().includes('opłatu') && header.toLowerCase().includes('rok')],
    ['Wielkość instalacji', (header) => header.toLowerCase().includes('wielkość') && header.toLowerCase().includes('instalacji')],
    ['Wielkość instalacji w umowie', (header) => header.toLowerCase().includes('wielkość') && header.toLowerCase().includes('umowie')],
  ];

  const questions = {};
  questionMappings.forEach(([label, matcher]) => {
    const index = headers.findIndex(matcher);
    if (index >= 0 && !questions[label]) questions[label] = index;
  });

  const reservedIdx = new Set([nameIdx, phoneIdx, addressIdx, dateIdx, agentIdx, assignedIdx, commentIdx, intIdx, calendarIdx].filter((index) => typeof index === 'number' && index >= 0));
  const mappedQuestionIdx = new Set(Object.values(questions).filter((index) => typeof index === 'number' && index >= 0));

  const buildInterviewData = (row) => {
    const data = {};
    for (const [label, index] of Object.entries(questions)) {
      if (typeof index !== 'number' || index < 0) continue;
      const answer = String(row[index] || '').trim();
      if (answer) data[label] = answer;
    }
    for (let index = 0; index < headers.length; index++) {
      if (reservedIdx.has(index) || mappedQuestionIdx.has(index)) continue;
      const label = headers[index];
      if (!label) continue;
      const value = String(row[index] || '').trim();
      if (!value || data[label]) continue;
      data[label] = value;
    }
    return Object.keys(data).length > 0 ? data : null;
  };

  const meetings = [];
  const phoneContacts = [];

  for (const row of rows.slice(1)) {
    const statusValue = String(row[intIdx] || '').trim();
    const name = String(nameIdx >= 0 ? row[nameIdx] || '' : '').trim();
    if (!name) continue;

    const base = {
      client_name: name,
      phone: phoneIdx >= 0 ? String(row[phoneIdx] || '') : '',
      address: addressIdx >= 0 ? String(row[addressIdx] || '') : '',
      date: dateIdx >= 0 ? String(row[dateIdx] || '') : '',
      agent: agentIdx >= 0 ? String(row[agentIdx] || '') : (assignedIdx >= 0 ? String(row[assignedIdx] || '') : ''),
      comments: commentIdx >= 0 ? String(row[commentIdx] || '') : '',
      sheet: sheetTitle,
      status: statusValue,
      interview_data: buildInterviewData(row),
    };

    if (statusValue.toLowerCase() === 'spotkanie') {
      meetings.push({
        ...base,
        meeting_calendar: calendarIdx >= 0 ? String(row[calendarIdx] || '') : '',
        meeting_note: statusValue,
      });
      continue;
    }

    if (statusValue.toLowerCase().includes('kontakt') || statusValue.toLowerCase().includes('telefon') || statusValue.toLowerCase().includes('doradc') || statusValue.toLowerCase() === 'dws') {
      const parsedDate = dateIdx >= 0 && row[dateIdx]
        ? (() => {
            const match = String(row[dateIdx]).match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
            if (!match) return '';
            return `${match[3]}-${String(match[2]).padStart(2, '0')}-${String(match[1]).padStart(2, '0')}`;
          })()
        : '';

      phoneContacts.push({
        ...base,
        contact_calendar: calendarIdx >= 0 ? String(row[calendarIdx] || '') : '',
        contact_key: `${sheetTitle}__${name}__${dateIdx >= 0 ? String(row[dateIdx] || '') : ''}`,
        contact_date: parsedDate,
      });
    }
  }

  return { meetings, phoneContacts };
}

async function fetchParsedSheets(accessToken, spreadsheetId, activeTabs) {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const meetings = [];
  const phoneContacts = [];

  for (const chunk of chunkArray(activeTabs, MAX_BATCH_RANGES)) {
    const params = new URLSearchParams({ majorDimension: 'ROWS' });
    chunk.forEach((tab) => params.append('ranges', `'${tab.replace(/'/g, "''")}'!${RANGE_SUFFIX}`));

    const data = await fetchJsonWithRetry(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${params.toString()}`,
      { headers },
      `values:batchGet (${chunk.length} tabs)`
    );

    for (const valueRange of data.valueRanges || []) {
      const sheetTitle = extractSheetTitle(valueRange.range);
      const parsed = parseSheetRows(sheetTitle, valueRange.values || []);
      meetings.push(...parsed.meetings);
      phoneContacts.push(...parsed.phoneContacts);
    }
  }

  return { meetings, phoneContacts };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const spreadsheetId = extractSpreadsheetId(Deno.env.get('GOOGLE_SHEETS_SPREADSHEET_ID'));
    const allowedUsers = await base44.asServiceRole.entities.AllowedUser.list();
    const ua = allowedUsers.find((item) => (item.email || item.data?.email) === user.email);
    const role = ua?.role || ua?.data?.role;

    const isLeaderOrAdmin = role === 'admin' || role === 'group_leader' || role === 'team_leader';
    const isAdvisor = role === 'advisor' || role === 'user';
    if (!isLeaderOrAdmin && !isAdvisor) {
      return Response.json({ error: 'Forbidden – brak uprawnień' }, { status: 403 });
    }

    const accessToken = await getGoogleSheetsAccessToken(base44);
    const sheetMappings = await base44.asServiceRole.entities.SheetGroupMapping.list();
    const allTabs = await getAllSheetTabs(accessToken, spreadsheetId, sheetMappings);

    const activeTabs = allTabs.filter((tab) => {
      const mapping = sheetMappings.find((item) => (item.sheet_name || item.data?.sheet_name) === tab);
      const isActive = mapping?.is_active ?? mapping?.data?.is_active;
      return !mapping || isActive !== false;
    });

    let { meetings, phoneContacts } = await fetchParsedSheets(accessToken, spreadsheetId, activeTabs);

    if (isAdvisor) {
      const assignments = await base44.asServiceRole.entities.MeetingAssignment.filter({ assigned_user_email: user.email });
      const assignedKeys = new Set(assignments.map((assignment) => assignment.meeting_key));
      meetings = meetings.filter((meeting) => assignedKeys.has(`${meeting.sheet}__${meeting.client_name}__${meeting.meeting_calendar}`));
      phoneContacts = [];
    }

    return Response.json({
      meetings,
      phoneContacts,
      total: meetings.length,
      totalPhoneContacts: phoneContacts.length,
      refreshed_at: new Date().toISOString(),
      source: 'live',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});