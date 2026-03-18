import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Pobierz wszystkie CalendarEventy z source=meeting_assignment i bez location
  const allEvents = await base44.asServiceRole.entities.CalendarEvent.list('-event_date', 1000);
  const assignments = await base44.asServiceRole.entities.MeetingAssignment.list('-created_date', 1000);

  // Stwórz mapę: meeting_key -> client_address
  const assignmentMap = {};
  for (const a of assignments) {
    if (a.meeting_key && a.client_address) {
      assignmentMap[a.meeting_key] = a.client_address;
    }
  }

  let updated = 0;
  let skipped = 0;

  for (const ev of allEvents) {
    // Tylko eventy z meeting_assignment_id i bez location
    if (!ev.meeting_assignment_id) { skipped++; continue; }
    if (ev.location) { skipped++; continue; }

    const address = assignmentMap[ev.meeting_assignment_id];
    if (!address) { skipped++; continue; }

    await base44.asServiceRole.entities.CalendarEvent.update(ev.id, { location: address });
    updated++;
  }

  return Response.json({ updated, skipped, total: allEvents.length });
});