import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

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

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');
  const allTabs = await getAllSheetTabs(accessToken);

  // Pobierz dane ze wszystkich arkuszy (równolegle)
  const allMaps = await Promise.all(allTabs.map(tab => fetchAddressMapFromSheet(accessToken, tab)));
  const masterMap = Object.assign({}, ...allMaps);

  console.error('[sync] Kluczy w mapie:', Object.keys(masterMap).length);

  // Pobierz wszystkie MeetingAssignment bez adresu
  const assignments = await base44.asServiceRole.entities.MeetingAssignment.list('-created_date', 2000);
  const toUpdate = assignments.filter(a => {
    if (!a.meeting_key) return false;
    const sheetData = masterMap[a.meeting_key];
    if (!sheetData) return false;
    return (sheetData.address && !a.client_address) || (sheetData.phone && !a.client_phone);
  });

  console.error('[sync] Do aktualizacji:', toUpdate.length);

  // Aktualizuj sekwencyjnie (żeby nie przekroczyć rate limit)
  let updatedAssignments = 0;
  let updatedEvents = 0;

  for (const a of toUpdate) {
    const sheetData = masterMap[a.meeting_key];
    const patch = {};
    if (sheetData.address && !a.client_address) patch.client_address = sheetData.address;
    if (sheetData.phone && !a.client_phone) patch.client_phone = sheetData.phone;

    await base44.asServiceRole.entities.MeetingAssignment.update(a.id, patch);
    updatedAssignments++;

    // Zaktualizuj powiązany CalendarEvent
    if (patch.client_address) {
      const events = await base44.asServiceRole.entities.CalendarEvent.filter({ meeting_assignment_id: a.meeting_key });
      for (const ev of events) {
        if (!ev.location) {
          await base44.asServiceRole.entities.CalendarEvent.update(ev.id, { location: patch.client_address });
          updatedEvents++;
        }
      }
    }

    // Mała pauza żeby nie przekroczyć rate limit
    await new Promise(r => setTimeout(r, 100));
  }

  return Response.json({
    total_in_map: Object.keys(masterMap).length,
    total_assignments: assignments.length,
    updated_assignments: updatedAssignments,
    updated_events: updatedEvents,
  });
});