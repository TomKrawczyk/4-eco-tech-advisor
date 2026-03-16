import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const sheetFilter = body.sheet; // opcjonalne — filtruj po arkuszu

  // 1. Pobierz wszystkie MeetingAssignment z adresem
  const assignments = sheetFilter
    ? await base44.asServiceRole.entities.MeetingAssignment.filter({ sheet: sheetFilter })
    : await base44.asServiceRole.entities.MeetingAssignment.list();

  const withAddress = assignments.filter(a => a.client_address && a.meeting_key && a.assigned_user_email);
  const keyToAddress = {};
  for (const a of withAddress) {
    keyToAddress[a.meeting_key] = a.client_address;
  }

  // 2. Pobierz CalendarEventy przypisane (owner_email istnieje) bez lokalizacji
  // Filtruj po owner_email żeby ograniczyć zbiór - podziel na batche po assigned_user
  const uniqueEmails = [...new Set(withAddress.map(a => a.assigned_user_email))];

  let updatedEvents = 0;
  const errors = [];

  for (const email of uniqueEmails) {
    try {
      const events = await base44.asServiceRole.entities.CalendarEvent.filter({
        owner_email: email,
        source: "meeting_assignment"
      });

      for (const ev of events) {
        const addr = keyToAddress[ev.meeting_assignment_id];
        if (addr && (!ev.location || ev.location.trim() === '')) {
          await base44.asServiceRole.entities.CalendarEvent.update(ev.id, { location: addr });
          updatedEvents++;
        }
      }
    } catch (e) {
      errors.push({ email, error: e.message });
    }
  }

  return Response.json({
    sheet: sheetFilter || 'all',
    assignments_with_address: withAddress.length,
    unique_users: uniqueEmails.length,
    updated_events: updatedEvents,
    errors,
    done: true
  });
});