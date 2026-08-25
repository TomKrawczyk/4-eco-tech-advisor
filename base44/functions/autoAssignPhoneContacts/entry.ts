import { createClientFromRequest } from 'npm:@base44/sdk@0.8.43';
import { secrets } from 'base44:runtime';
import {
  RANGE_SUFFIX,
  MAX_BATCH_RANGES,
  extractSpreadsheetId,
  normalizeHeader,
  extractSheetTitle,
  chunkArray,
  fetchJsonWithRetry,
  getGoogleSheetsAccessToken,
} from "../../shared/googleSheets.ts";

const MAX_RECORDS_PER_RUN = 800;

// Wyciąga z arkusza tylko kontakty telefoniczne ("kontakt do doradcy" / "dws") —
// wystarczające dane do utworzenia rekordu PhoneContact i przypisania.
function parsePhoneContactsFromSheet(sheetTitle, rows) {
  if (!rows || rows.length < 2) return [];
  const headers = rows[0].map(normalizeHeader);
  const headersLower = headers.map((h) => h.toLowerCase());
  const findHeader = (predicate) => headersLower.findIndex(predicate);

  const nameIdx = findHeader((h) => h.includes('imię i nazwisko') || (h.includes('imię') && h.includes('nazwisko')));
  const phoneIdx = findHeader((h) =>
    h.includes('numer telefonu') || h.includes('telefon') || h.includes('tel.') || h === 'tel' || h.includes('phone') || (h.includes('kontakt') && h.includes('nr'))
  );
  const addressIdx = findHeader((h) => h === 'adres');
  const dateIdx = findHeader((h) => h === 'data kontaktu');
  const agentIdx = findHeader((h) => h === 'agent dzwoniący' || h.startsWith('agent '));
  const assignedIdx = findHeader((h) => h === 'komu przypisane' || h.includes('komu przypisane'));
  const commentIdx = (() => {
    const exact = findHeader((h) => h.includes('komentarz dws'));
    if (exact >= 0) return exact;
    const broad = findHeader((h) => h.includes('komentarz'));
    if (broad >= 0) return broad;
    return findHeader((h) => h.includes('uwagi') || h.includes('notatki'));
  })();
  const intIdx = findHeader((h) => h.includes('zainteresowany rozmową z doradcą') || (h.includes('zainteresowany') && h.includes('doradc')));
  const calendarIdx = findHeader((h) => h.includes('data i godzina spotkania') || (h.includes('data') && h.includes('godzina') && h.includes('spotkan')));

  const out = [];
  for (const row of rows.slice(1)) {
    const statusValue = String(row[intIdx] || '').trim();
    const name = nameIdx >= 0 ? String(row[nameIdx] || '').trim() : '';
    if (!name) continue;
    const statusLower = statusValue.toLowerCase();
    // Spotkania pomijamy — dotyczy tylko kontaktów telefonicznych do doradcy.
    if (statusLower === 'spotkanie') continue;
    if (
      !statusLower.includes('kontakt') &&
      !statusLower.includes('telefon') &&
      !statusLower.includes('doradc') &&
      statusLower !== 'dws'
    ) {
      continue;
    }

    const dateRaw = dateIdx >= 0 ? String(row[dateIdx] || '') : '';
    const parsedDate = (() => {
      const match = dateRaw.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
      if (!match) return '';
      return `${match[3]}-${String(match[2]).padStart(2, '0')}-${String(match[1]).padStart(2, '0')}`;
    })();

    out.push({
      contact_key: `${sheetTitle}__${name}__${dateRaw}`,
      sheet: sheetTitle,
      client_name: name,
      phone: phoneIdx >= 0 ? String(row[phoneIdx] || '') : '',
      address: addressIdx >= 0 ? String(row[addressIdx] || '') : '',
      date: dateRaw,
      agent: agentIdx >= 0 ? String(row[agentIdx] || '') : (assignedIdx >= 0 ? String(row[assignedIdx] || '') : ''),
      comments: commentIdx >= 0 ? String(row[commentIdx] || '') : '',
      status: statusValue,
      contact_calendar: calendarIdx >= 0 ? String(row[calendarIdx] || '') : '',
      contact_date: parsedDate,
    });
  }
  return out;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // Funkcja działa zarówno jako zadanie cykliczne (service-role, bez użytkownika),
    // jak i po wywołaniu z frontu — wtedy wymagamy roli lidera/admina.
    let invokingUser = null;
    try { invokingUser = await base44.auth.me(); } catch (_) {}
    if (invokingUser) {
      const allowedUsers = await base44.asServiceRole.entities.AllowedUser.list();
      const ua = allowedUsers.find((item) => (item.email || item.data?.email) === invokingUser.email);
      const role = ua?.role || ua?.data?.role;
      const allowedRole = role === 'admin' || role === 'hr_admin' || role === 'group_leader' || role === 'team_leader';
      if (!allowedRole) {
        return Response.json({ error: 'Forbidden – brak uprawnień' }, { status: 403 });
      }
    }

    const spreadsheetId = extractSpreadsheetId(secrets.get('GOOGLE_SHEETS_SPREADSHEET_ID'));
    const accessToken = await getGoogleSheetsAccessToken(base44);

    // 1) Aktywne mappingi arkusz→grupa (z pominięciem pustych group_id).
    const sheetMappings = await base44.asServiceRole.entities.SheetGroupMapping.list();
    const activeMappings = sheetMappings
      .map((item) => ({
        sheet_name: item.sheet_name || item.data?.sheet_name,
        group_id: item.group_id || item.data?.group_id,
        group_name: item.group_name || item.data?.group_name,
        is_active: item.is_active ?? item.data?.is_active,
      }))
      .filter((m) => m.sheet_name && m.group_id && m.is_active !== false);

    if (activeMappings.length === 0) {
      return Response.json({ ok: true, message: 'Brak aktywnych mappingów arkusz→grupa.', processed: 0, assigned: 0, skipped: 0 });
    }

    // 2) Doradcy per grupa (role advisor/user, nie zablokowani, z group_id).
    const allowedUsers = await base44.asServiceRole.entities.AllowedUser.list();
    const advisorsPerGroup = {};
    const groupNameCache = {};
    for (const u of allowedUsers) {
      const role = u.role || u.data?.role;
      const isBlocked = (u.is_blocked ?? u.data?.is_blocked) === true;
      const groupId = u.group_id || u.data?.group_id;
      const email = u.email || u.data?.email;
      const name = u.name || u.data?.name;
      if (!email || !groupId || isBlocked) continue;
      if (role !== 'advisor' && role !== 'user') continue;
      if (!advisorsPerGroup[groupId]) advisorsPerGroup[groupId] = [];
      advisorsPerGroup[groupId].push({ email, name });
      if (!groupNameCache[groupId]) groupNameCache[groupId] = u.data?.group_name || '';
    }
    for (const m of activeMappings) {
      groupNameCache[m.group_id] = groupNameCache[m.group_id] || m.group_name || '';
    }

    // 3) Istniejące rekordy PhoneContact (najnowsze) — pomijanie ręcznie przypisanych
    // i liczenie obciążenia doradców (round-robin z wyważaniem).
    const existingRecords = await base44.asServiceRole.entities.PhoneContact.list('-created_date', 2000);
    const existingByKey = new Map();
    const advisorLoad = {};
    for (const rec of existingRecords) {
      if (rec.contact_key && !existingByKey.has(rec.contact_key)) {
        existingByKey.set(rec.contact_key, rec);
      }
      if (rec.assigned_user_email) {
        advisorLoad[rec.assigned_user_email] = (advisorLoad[rec.assigned_user_email] || 0) + 1;
      }
    }

    // 4) Pobierz zakładki z arkusza (batchGet) i przetwórz kontakty.
    const tabs = [...new Set(activeMappings.map((m) => m.sheet_name))];
    const mappingBySheet = new Map(activeMappings.map((m) => [m.sheet_name, m]));

    const allPhoneContacts = [];
    for (const chunk of chunkArray(tabs, MAX_BATCH_RANGES)) {
      const params = new URLSearchParams({ majorDimension: 'ROWS' });
      chunk.forEach((tab) => params.append('ranges', `'${tab.replace(/'/g, "''")}'!${RANGE_SUFFIX}`));
      const data = await fetchJsonWithRetry(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${params.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
        `autoAssign:batchGet (${chunk.length} tabs)`
      );
      for (const valueRange of data.valueRanges || []) {
        const sheetTitle = extractSheetTitle(valueRange.range);
        const mapping = mappingBySheet.get(sheetTitle);
        if (!mapping) continue;
        const parsed = parsePhoneContactsFromSheet(sheetTitle, valueRange.values || []);
        for (const c of parsed) {
          allPhoneContacts.push({ ...c, mapping });
        }
      }
    }

    const pickAdvisorForGroup = (groupId) => {
      const list = advisorsPerGroup[groupId];
      if (!list || list.length === 0) return null;
      // wybierz doradcę z najmniejszym obciążeniem (round-robin z wyważaniem)
      let best = list[0];
      let bestLoad = advisorLoad[best.email] || 0;
      for (const cand of list) {
        const load = advisorLoad[cand.email] || 0;
        if (load < bestLoad) {
          best = cand;
          bestLoad = load;
        }
      }
      return best;
    };

    let processed = 0;
    let assigned = 0;
    let groupOnly = 0;
    let skipped = 0;
    const perGroup = {};
    const createdRecords = [];

    for (const contact of allPhoneContacts) {
      if (processed >= MAX_RECORDS_PER_RUN) break;
      processed++;
      const groupId = contact.mapping.group_id;
      const groupName = groupNameCache[groupId] || contact.mapping.group_name || '';
      perGroup[groupName || groupId] = (perGroup[groupName || groupId] || 0) + 1;

      const existing = existingByKey.get(contact.contact_key);
      if (existing && existing.assigned_user_email) {
        skipped++;
        continue;
      }

      const advisor = pickAdvisorForGroup(groupId);
      const patch = {
        sheet: contact.sheet,
        client_name: contact.client_name,
        phone: contact.phone || '',
        address: contact.address || '',
        date: contact.date || '',
        agent: contact.agent || '',
        contact_calendar: contact.contact_calendar || '',
        status: contact.status || '',
        comments: contact.comments || '',
        contact_date: contact.contact_date || '',
        assigned_group_id: groupId,
        assigned_group_name: groupName,
      };
      if (advisorsPerGroup[groupId] && advisor) {
        patch.assigned_user_email = advisor.email;
        patch.assigned_user_name = advisor.name || '';
        advisorLoad[advisor.email] = (advisorLoad[advisor.email] || 0) + 1;
        assigned++;
      } else {
        // Brak doradców w grupie — przypisz tylko grupę, kontakt widoczny dla lidera grupy do manualnej dystrybucji.
        groupOnly++;
      }

      try {
        if (existing) {
          const updated = await base44.asServiceRole.entities.PhoneContact.update(existing.id, patch);
          createdRecords.push(updated);
        } else {
          const createdRec = await base44.asServiceRole.entities.PhoneContact.create({ contact_key: contact.contact_key, ...patch });
          createdRecords.push(createdRec);
          existingByKey.set(contact.contact_key, createdRec);
        }
      } catch (_) {
        // pojedynczy błąd upsertu nie przerywa całego przebiegu
      }
    }

    return Response.json({
      ok: true,
      processed,
      assigned,
      groupOnly,
      skipped,
      tabsProcessed: tabs.length,
      perGroup,
      assigned_records: createdRecords.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}