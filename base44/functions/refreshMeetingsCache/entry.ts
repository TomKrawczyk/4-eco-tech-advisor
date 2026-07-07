import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const CACHE_KEY = 'meetings_main';
const LITE_CACHE_KEY = 'meetings_lite';

function toLiteMeeting(meeting) {
  const hasInterview = !!meeting.interview_data && Object.values(meeting.interview_data).some((value) => String(value || '').trim());
  const hasComments = String(meeting.comments || '').trim().length > 2;
  return {
    sheet: meeting.sheet,
    client_name: meeting.client_name,
    phone: meeting.phone || '',
    address: meeting.address || '',
    date: meeting.date || '',
    agent: meeting.agent || '',
    meeting_calendar: meeting.meeting_calendar || '',
    status: meeting.status || '',
    meeting_note: meeting.meeting_note || '',
    has_details: !!(meeting.agent || hasComments || hasInterview),
    has_inline_report: hasComments || hasInterview,
  };
}

async function upsertCacheRecord(svc, cacheKey, payload) {
  const rows = await svc.MeetingsCache.filter({ cache_key: cacheKey }, '-updated_date', 1);
  if (rows[0]) await svc.MeetingsCache.update(rows[0].id, payload);
  else await svc.MeetingsCache.create({ cache_key: cacheKey, ...payload });
}
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

function parseMeetingDate(value) {
  if (!value) return null;
  const isoMatch = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  const plMatch = String(value).match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (plMatch) return new Date(Number(plMatch[3]), Number(plMatch[2]) - 1, Number(plMatch[1]));
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function extractSheetTitle(range) {
  if (!range) return '';
  if (range.startsWith("'")) {
    const end = range.indexOf("'!");
    if (end > 0) return range.slice(1, end).replace(/''/g, "'");
  }
  return range.split('!')[0];
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function createMeetingKey(meeting) {
  return `${meeting.sheet}__${meeting.client_name}__${meeting.meeting_calendar}`;
}

function createPhoneContactKey(contact) {
  return `${contact.sheet}__${contact.client_name}__${contact.date}`;
}

async function fetchAll(entity) {
  const rows = [];
  let skip = 0;
  const limit = 500;
  while (true) {
    const batch = await entity.list('-created_date', limit, skip);
    if (!batch || batch.length === 0) break;
    rows.push(...batch);
    if (batch.length < limit) break;
    skip += limit;
    if (skip > 50000) break;
  }
  return rows;
}

async function fetchJsonWithRetry(url, options, label) {
  let lastError = `${label}: unknown error`;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type') || '';
    const rawBody = await response.text();
    const bodyPreview = rawBody.slice(0, 500);
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
        : `${label}: Google API ${response.status} – ${bodyPreview}`;
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
    throw new Error('Google Sheets connector zwrócił nieprawidłowy token dostępu.');
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

  const data = await fetchJsonWithRetry(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?includeGridData=false`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    'spreadsheet metadata'
  );
  const metadataTabs = (data.sheets || []).map((sheet) => sheet.properties?.title).filter(Boolean);
  return [...new Set([...mappedTabs, ...metadataTabs])];
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

async function bulkCreateInBatches(entity, items) {
  for (const batch of chunkArray(items, 200)) {
    if (batch.length) await entity.bulkCreate(batch);
  }
}

async function bulkUpdateInBatches(entity, items) {
  for (const batch of chunkArray(items, 200)) {
    if (batch.length) await entity.bulkUpdate(batch);
  }
}

async function syncAssignmentsAndContacts(svc, meetings, phoneContacts) {
  const [existingAssignments, existingContacts, calendarEvents] = await Promise.all([
    fetchAll(svc.MeetingAssignment),
    fetchAll(svc.PhoneContact),
    fetchAll(svc.CalendarEvent),
  ]);

  const assignmentMap = new Map(existingAssignments.map((assignment) => [assignment.meeting_key, assignment]));
  const existingContactKeys = new Set(existingContacts.map((contact) => contact.contact_key));

  const assignmentsToCreate = [];
  const assignmentsToUpdate = [];
  const contactsToCreate = [];
  const addressByMeetingKey = new Map();

  for (const meeting of meetings) {
    const meetingKey = createMeetingKey(meeting);
    const existing = assignmentMap.get(meetingKey);
    const parsedDate = parseMeetingDate(meeting.meeting_calendar);
    if (!existing) {
      assignmentsToCreate.push({
        meeting_key: meetingKey,
        sheet: meeting.sheet,
        client_name: meeting.client_name,
        client_phone: meeting.phone || '',
        client_address: meeting.address || '',
        meeting_calendar: meeting.meeting_calendar,
        meeting_date: parsedDate ? formatDate(parsedDate) : '',
        agent: meeting.agent || '',
        comments: meeting.comments || '',
        interview_data: meeting.interview_data || {},
      });
      continue;
    }

    const patch = { id: existing.id };
    let hasChanges = false;

    if (meeting.address && !existing.client_address) {
      patch.client_address = meeting.address;
      addressByMeetingKey.set(meetingKey, meeting.address);
      hasChanges = true;
    }
    if (meeting.phone && !existing.client_phone) {
      patch.client_phone = meeting.phone;
      hasChanges = true;
    }
    if (meeting.agent && !existing.agent) {
      patch.agent = meeting.agent;
      hasChanges = true;
    }
    if (meeting.comments && !existing.comments) {
      patch.comments = meeting.comments;
      hasChanges = true;
    }
    if (parsedDate && !existing.meeting_date) {
      patch.meeting_date = formatDate(parsedDate);
      hasChanges = true;
    }
    if (meeting.interview_data && Object.keys(meeting.interview_data).length > 0 && (!existing.interview_data || Object.keys(existing.interview_data).length === 0)) {
      patch.interview_data = meeting.interview_data;
      hasChanges = true;
    }

    if (hasChanges) assignmentsToUpdate.push(patch);
  }

  for (const contact of phoneContacts) {
    const contactKey = createPhoneContactKey(contact);
    if (existingContactKeys.has(contactKey)) continue;
    const parsedDate = parseMeetingDate(contact.contact_calendar || contact.date);
    contactsToCreate.push({
      contact_key: contactKey,
      sheet: contact.sheet,
      client_name: contact.client_name,
      phone: contact.phone || '',
      address: contact.address || '',
      date: contact.date || '',
      agent: contact.agent || '',
      contact_calendar: contact.contact_calendar || '',
      status: contact.status || '',
      comments: contact.comments || '',
      interview_data: contact.interview_data || {},
      contact_date: contact.contact_date || (parsedDate ? formatDate(parsedDate) : ''),
    });
  }

  const calendarUpdates = [];
  if (addressByMeetingKey.size > 0) {
    for (const event of calendarEvents) {
      const newAddress = addressByMeetingKey.get(event.meeting_assignment_id);
      if (newAddress && !event.location) {
        calendarUpdates.push({ id: event.id, location: newAddress });
      }
    }
  }

  await bulkCreateInBatches(svc.MeetingAssignment, assignmentsToCreate);
  await bulkUpdateInBatches(svc.MeetingAssignment, assignmentsToUpdate);
  await bulkCreateInBatches(svc.PhoneContact, contactsToCreate);
  await bulkUpdateInBatches(svc.CalendarEvent, calendarUpdates);

  return {
    new_meetings: assignmentsToCreate.length,
    updated_meetings: assignmentsToUpdate.length,
    new_contacts: contactsToCreate.length,
    updated_calendar_events: calendarUpdates.length,
  };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const svc = base44.asServiceRole.entities;
  const spreadsheetId = extractSpreadsheetId(Deno.env.get('GOOGLE_SHEETS_SPREADSHEET_ID'));
  const nowIso = new Date().toISOString();
  let cacheRecord = null;

  try {
    const existingCache = await svc.MeetingsCache.filter({ cache_key: CACHE_KEY }, '-updated_date', 1);
    cacheRecord = existingCache[0] || null;

    const refreshingPayload = {
      cache_key: CACHE_KEY,
      status: 'refreshing',
      error_message: '',
    };

    if (cacheRecord) await svc.MeetingsCache.update(cacheRecord.id, refreshingPayload);
    else cacheRecord = await svc.MeetingsCache.create(refreshingPayload);

    const accessToken = await getGoogleSheetsAccessToken(base44);
    const sheetMappings = await fetchAll(svc.SheetGroupMapping);
    const allTabs = await getAllSheetTabs(accessToken, spreadsheetId, sheetMappings);

    const activeTabs = allTabs.filter((tab) => {
      const mapping = sheetMappings.find((item) => (item.sheet_name || item.data?.sheet_name) === tab);
      const isActive = mapping?.is_active ?? mapping?.data?.is_active;
      return !mapping || isActive !== false;
    });

    const { meetings, phoneContacts } = await fetchParsedSheets(accessToken, spreadsheetId, activeTabs);
    const syncStats = await syncAssignmentsAndContacts(svc, meetings, phoneContacts);

    await svc.MeetingsCache.update(cacheRecord.id, {
      cache_key: CACHE_KEY,
      meetings_json: { meetings },
      last_refreshed: nowIso,
      status: 'success',
      error_message: '',
      meetings_count: meetings.length,
    });

    // Lekki indeks dla frontendu — bez interview_data i pełnych komentarzy
    await upsertCacheRecord(svc, LITE_CACHE_KEY, {
      meetings_json: { meetings: meetings.map(toLiteMeeting) },
      last_refreshed: nowIso,
      status: 'success',
      error_message: '',
      meetings_count: meetings.length,
    });

    return Response.json({
      success: true,
      meetings_count: meetings.length,
      phone_contacts_count: phoneContacts.length,
      active_tabs: activeTabs.length,
      last_refreshed: nowIso,
      ...syncStats,
    });
  } catch (error) {
    const message = error?.message || 'Unknown error';
    if (cacheRecord?.id) {
      await svc.MeetingsCache.update(cacheRecord.id, {
        status: 'error',
        error_message: message,
      });
    }
    return Response.json({ error: message }, { status: 500 });
  }
});