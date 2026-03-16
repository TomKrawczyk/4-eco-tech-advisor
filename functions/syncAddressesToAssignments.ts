import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const SPREADSHEET_ID = '19aramNGcpY7ssEcpX34KPI5qmQUWQWVgAF-XC0WiKH8';

async function fetchAddressMapFromSheet(accessToken, sheetTitle) {
  const range = `'${sheetTitle}'!A1:Z3000`;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return {};
  const data = await res.json();
  const rows = data.values || [];
  if (rows.length < 2) return {};

  const headers = rows[0];
  const nameIdx = headers.findIndex(h => h.includes('Imię i nazwisko'));
  const addressIdx = headers.findIndex(h => h.trim() === 'Adres');
  const phoneIdx = headers.findIndex(h =>
    h.includes('Numer telefonu') || h.toLowerCase().includes('telefon') || h.toLowerCase() === 'tel'
  );
  const calendarIdx = headers.findIndex(h => h.includes('Data i godzina spotkania'));
  const intIdx = headers.findIndex(h => h.includes('Zainteresowany rozmową z doradcą'));

  if (nameIdx === -1 || intIdx === -1) return {};

  const map = {};
  for (const row of rows.slice(1)) {
    const intVal = (row[intIdx] || '').trim().toLowerCase();
    if (intVal !== 'spotkanie') continue;
    const name = (row[nameIdx] || '').trim();
    if (!name) continue;
    const calendar = calendarIdx >= 0 ? (row[calendarIdx] || '').trim() : '';
    const address = addressIdx >= 0 ? (row[addressIdx] || '').trim() : '';
    const phone = phoneIdx >= 0 ? (row[phoneIdx] || '').trim() : '';
    const key = `${sheetTitle}__${name}__${calendar}`;
    if (address || phone) {
      map[key] = { address, phone };
    }
  }
  return map;
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  // Wymagane: sheet - nazwa konkretnej zakładki do synchronizacji
  const sheetTitle = body.sheet;
  if (!sheetTitle) {
    return Response.json({ error: 'Podaj parametr "sheet" - nazwę zakładki do synchronizacji' }, { status: 400 });
  }

  const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

  // Pobierz mapę adresów dla tego arkusza
  const sheetMap = await fetchAddressMapFromSheet(accessToken, sheetTitle);
  const keysInSheet = Object.keys(sheetMap).length;

  if (keysInSheet === 0) {
    return Response.json({ sheet: sheetTitle, message: 'Brak wierszy ze spotkaniami w tym arkuszu', updated: 0 });
  }

  // Pobierz tylko assignment'y z tego arkusza
  const assignments = await base44.asServiceRole.entities.MeetingAssignment.filter({ sheet: sheetTitle });
  await sleep(300);

  // Assignmenty do aktualizacji: brakuje adresu/telefonu
  const toUpdateAssignments = assignments.filter(a => {
    if (!a.meeting_key) return false;
    const sd = sheetMap[a.meeting_key];
    if (!sd) return false;
    return (sd.address && !a.client_address) || (sd.phone && !a.client_phone);
  });

  // Assignmenty które mają adres ale powiązany CalendarEvent ma pustą lokalizację
  const toFixEvents = assignments.filter(a => {
    if (!a.meeting_key || !a.client_address) return false;
    return !toUpdateAssignments.includes(a); // nie duplikuj tych co i tak idą wyżej
  });

  let updatedAssignments = 0;
  let updatedEvents = 0;
  const errors = [];

  for (const a of toUpdateAssignments) {
    const sd = sheetMap[a.meeting_key];
    const patch = {};
    if (sd.address && !a.client_address) patch.client_address = sd.address;
    if (sd.phone && !a.client_phone) patch.client_phone = sd.phone;

    try {
      await base44.asServiceRole.entities.MeetingAssignment.update(a.id, patch);
      updatedAssignments++;
      await sleep(400);

      if (patch.client_address) {
        const events = await base44.asServiceRole.entities.CalendarEvent.filter({ meeting_assignment_id: a.meeting_key });
        await sleep(200);
        for (const ev of events) {
          if (!ev.location || ev.location.trim() === '') {
            await base44.asServiceRole.entities.CalendarEvent.update(ev.id, { location: patch.client_address });
            updatedEvents++;
            await sleep(200);
          }
        }
      }
    } catch (e) {
      errors.push({ key: a.meeting_key, error: e.message });
      await sleep(800);
    }
  }

  // Napraw eventy które mają pusty location mimo że assignment ma adres
  for (const a of toFixEvents) {
    try {
      const events = await base44.asServiceRole.entities.CalendarEvent.filter({ meeting_assignment_id: a.meeting_key });
      await sleep(200);
      for (const ev of events) {
        if (!ev.location || ev.location.trim() === '') {
          await base44.asServiceRole.entities.CalendarEvent.update(ev.id, { location: a.client_address });
          updatedEvents++;
          await sleep(200);
        }
      }
    } catch (e) {
      errors.push({ key: a.meeting_key, error: e.message });
      await sleep(400);
    }
  }

  return Response.json({
    sheet: sheetTitle,
    keys_in_sheet: keysInSheet,
    assignments_in_sheet: assignments.length,
    to_update: toUpdate.length,
    updated_assignments: updatedAssignments,
    updated_events: updatedEvents,
    errors,
    done: true,
  });
});