import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const SPREADSHEET_ID = Deno.env.get('GOOGLE_SHEETS_SPREADSHEET_ID') || '19aramNGcpY7ssEcpX34KPI5qmQUWQWVgAF-XC0WiKH8';

async function getAllSheetTabs(accessToken) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?includeGridData=false`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return [];
  const meta = await res.json();
  return meta.sheets.map(s => s.properties.title);
}

async function fetchAddressesFromSheet(accessToken, sheetTitle) {
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

  if (nameIdx === -1) return {};

  // Mapa: client_name + calendar -> { address, phone }
  const map = {};
  for (const row of rows.slice(1)) {
    const name = (row[nameIdx] || '').trim();
    if (!name) continue;
    const calendar = calendarIdx >= 0 ? (row[calendarIdx] || '').trim() : '';
    const address = addressIdx >= 0 ? (row[addressIdx] || '').trim() : '';
    const phone = phoneIdx >= 0 ? (row[phoneIdx] || '').trim() : '';
    const key = `${sheetTitle}__${name}__${calendar}`;
    map[key] = { address, phone };
  }
  return map;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  console.error('[sync] user role:', user?.role);
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');
  const allTabs = await getAllSheetTabs(accessToken);
  console.error('[sync] Zakładki:', allTabs.length);

  // Pobierz wszystkie dane z arkuszy
  const allMaps = await Promise.all(allTabs.map(tab => fetchAddressesFromSheet(accessToken, tab)));
  const masterMap = Object.assign({}, ...allMaps);
  console.log('Łącznie kluczy w mapie:', Object.keys(masterMap).length);

  // Pobierz wszystkie MeetingAssignment
  const assignments = await base44.asServiceRole.entities.MeetingAssignment.list('-created_date', 2000);

  // Debug: sprawdź konkretny klucz
  const debugKey = 'Pomorskie - 2__MARCIN GŁODOWSKI__2026-03-16 11:00';
  console.log('Debug klucz w mapie:', debugKey in masterMap, JSON.stringify(masterMap[debugKey]));
  console.log('Przykładowe klucze z mapy (Pomorskie):', Object.keys(masterMap).filter(k => k.startsWith('Pomorskie - 2')).slice(0, 3));

  let updatedAssignments = 0;
  let updatedEvents = 0;

  for (const a of assignments) {
    const sheetData = masterMap[a.meeting_key];
    if (!sheetData) continue;

    const newAddress = sheetData.address;
    const newPhone = sheetData.phone;

    // Aktualizuj MeetingAssignment jeśli adres lub telefon się różni
    const needsUpdate =
      (newAddress && a.client_address !== newAddress) ||
      (newPhone && a.client_phone !== newPhone);

    if (needsUpdate) {
      const patch = {};
      if (newAddress && a.client_address !== newAddress) patch.client_address = newAddress;
      if (newPhone && a.client_phone !== newPhone) patch.client_phone = newPhone;

      await base44.asServiceRole.entities.MeetingAssignment.update(a.id, patch);
      updatedAssignments++;

      // Aktualizuj powiązane CalendarEvent
      const events = await base44.asServiceRole.entities.CalendarEvent.filter({ meeting_assignment_id: a.meeting_key });
      for (const ev of events) {
        const evPatch = {};
        if (patch.client_address) evPatch.location = patch.client_address;
        if (patch.client_phone) evPatch.client_phone = patch.client_phone;
        if (Object.keys(evPatch).length > 0) {
          await base44.asServiceRole.entities.CalendarEvent.update(ev.id, evPatch);
          updatedEvents++;
        }
      }
    }
  }

  console.log(`[syncAddresses] Zaktualizowane przypisania: ${updatedAssignments}, eventy: ${updatedEvents}`);
  return Response.json({ updated_assignments: updatedAssignments, updated_events: updatedEvents, total_assignments: assignments.length });
});