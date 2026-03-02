import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Sprawdza przypisane spotkania sprzed 2-24h i wysyła przypomnienie o raporcie jeśli brak
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const now = new Date();
    const assignments = await base44.asServiceRole.entities.MeetingAssignment.list();
    const meetingReports = await base44.asServiceRole.entities.MeetingReport.list();

    for (const assignment of assignments) {
      if (!assignment.meeting_date || !assignment.assigned_user_email) continue;

      const meetingDate = new Date(assignment.meeting_date);
      const diffHours = (now - meetingDate) / (1000 * 60 * 60);

      // Tylko spotkania, które odbyły się 2-26 godzin temu
      if (diffHours < 2 || diffHours > 26) continue;

      // Sprawdź czy raport już istnieje (dopasuj po nazwie klienta i dacie)
      const reportExists = meetingReports.some(r => {
        const nameMatch = (r.client_name || '').toLowerCase().trim() === (assignment.client_name || '').toLowerCase().trim();
        const dateMatch = r.meeting_date === assignment.meeting_date || r.created_date?.startsWith(assignment.meeting_date);
        const authorMatch = r.author_email === assignment.assigned_user_email || r.created_by === assignment.assigned_user_email;
        return nameMatch && authorMatch;
      });

      if (reportExists) continue;

      // Sprawdź czy już wysłano przypomnienie (szukaj powiadomienia)
      const existingNotif = await base44.asServiceRole.entities.Notification.filter({
        user_email: assignment.assigned_user_email,
        type: 'system_error',
      });
      const alreadyNotified = existingNotif.some(n =>
        n.message?.includes(assignment.client_name) &&
        n.message?.includes('raport') &&
        n.message?.includes(assignment.meeting_date)
      );

      if (alreadyNotified) continue;

      // Wyślij przypomnienie
      await base44.asServiceRole.entities.Notification.create({
        user_email: assignment.assigned_user_email,
        type: 'system_error',
        title: '⚠️ Brak raportu po spotkaniu',
        message: `Nie uzupełniono raportu po spotkaniu z klientem ${assignment.client_name} (${assignment.meeting_date}). Uzupełnij raport jak najszybciej!`,
        is_read: false,
      });

      // Email przypomnienie
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: assignment.assigned_user_email,
          subject: `Przypomnienie: Brak raportu – ${assignment.client_name}`,
          body: `Cześć!\n\nPrzypominamy, że nie uzupełniłeś/aś raportu po spotkaniu z klientem:\n\nKlient: ${assignment.client_name}\nData spotkania: ${assignment.meeting_date}\n\nProsimy o uzupełnienie raportu w aplikacji jak najszybciej.\n\nPozdrawiamy,\n4-ECO Green Energy`,
        });
      } catch (_) { /* ignoruj błąd email */ }
    }

    return Response.json({ ok: true, checked: assignments.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});