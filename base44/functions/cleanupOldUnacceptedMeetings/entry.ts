import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Jednorazowa funkcja do usunięcia przeterminowanych, niepodjętych spotkań
// Usuwa: MeetingAssignment + CalendarEvent dla spotkań przed dzisiejszą datą
// które NIE mają żadnej akceptacji (accepted) w MeetingAcceptance
//
// Opcjonalny parametr: group_id — jeśli podany, usuwa tylko dla tej grupy
// Opcjonalny parametr: dry_run (true/false) — jeśli true, tylko pokazuje co by usunął

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { group_id, dry_run = false } = body;

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Pobierz wszystkie przypisania
  const allAssignments = await base44.asServiceRole.entities.MeetingAssignment.list();

  // Filtruj: przeterminowane (meeting_date < dziś) + opcjonalnie z danej grupy
  let toProcess = allAssignments.filter(a => {
    const isPast = a.meeting_date && a.meeting_date < today;
    const matchGroup = !group_id || a.assigned_group_id === group_id;
    return isPast && matchGroup;
  });

  if (toProcess.length === 0) {
    return Response.json({ message: 'Brak przeterminowanych spotkań do usunięcia.', deleted: 0 });
  }

  // Pobierz akceptacje
  const allAcceptances = await base44.asServiceRole.entities.MeetingAcceptance.list();
  const acceptedAssignmentIds = new Set(
    allAcceptances
      .filter(a => a.status === 'accepted')
      .map(a => a.meeting_assignment_id)
  );

  // Zostaw tylko te BEZ akceptacji
  const unaccepted = toProcess.filter(a => !acceptedAssignmentIds.has(a.id));

  if (unaccepted.length === 0) {
    return Response.json({ message: 'Wszystkie przeterminowane spotkania zostały podjęte.', deleted: 0 });
  }

  // Znajdź powiązane CalendarEvents (po meeting_assignment_id)
  const allCalendarEvents = await base44.asServiceRole.entities.CalendarEvent.list();
  const relatedEventIds = allCalendarEvents
    .filter(e => unaccepted.some(a => a.id === e.meeting_assignment_id))
    .map(e => e.id);

  if (dry_run) {
    return Response.json({
      dry_run: true,
      would_delete_assignments: unaccepted.length,
      would_delete_calendar_events: relatedEventIds.length,
      assignments: unaccepted.map(a => ({
        id: a.id,
        client_name: a.client_name,
        meeting_date: a.meeting_date,
        group: a.assigned_group_name,
        sheet: a.sheet
      }))
    });
  }

  // Usuń CalendarEvents
  let deletedEvents = 0;
  for (const eventId of relatedEventIds) {
    await base44.asServiceRole.entities.CalendarEvent.delete(eventId);
    deletedEvents++;
  }

  // Usuń MeetingAssignments
  let deletedAssignments = 0;
  for (const assignment of unaccepted) {
    await base44.asServiceRole.entities.MeetingAssignment.delete(assignment.id);
    deletedAssignments++;
  }

  return Response.json({
    success: true,
    deleted_assignments: deletedAssignments,
    deleted_calendar_events: deletedEvents,
    message: `Usunięto ${deletedAssignments} przypisań i ${deletedEvents} wydarzeń kalendarzowych.`
  });
});