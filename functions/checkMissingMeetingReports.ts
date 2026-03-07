import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const emailTemplate = (clientName, meetingDate, daysAgo) => `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
  <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 24px 30px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 22px; letter-spacing: 0.5px;">⚠️ 4-ECO Green Energy</h1>
    <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0 0; font-size: 14px;">Przypomnienie o brakującym raporcie</p>
  </div>
  <div style="padding: 32px 30px; background: #f9fafb;">
    <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 18px;">Brak raportu po spotkaniu</h2>
    <p style="color: #4b5563; line-height: 1.7; margin: 0 0 10px 0;">Nie uzupełniono raportu po spotkaniu z klientem:</p>
    <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px 20px; margin: 16px 0;">
      <p style="margin: 0 0 8px 0; color: #1f2937;"><strong>Klient:</strong> ${clientName}</p>
      <p style="margin: 0 0 8px 0; color: #1f2937;"><strong>Data spotkania:</strong> ${meetingDate}</p>
      <p style="margin: 0; color: #ef4444;"><strong>Opóźnienie:</strong> ${daysAgo} ${daysAgo === 1 ? 'dzień' : 'dni'}</p>
    </div>
    <p style="color: #4b5563; line-height: 1.7; margin: 0 0 20px 0;">
      Prosimy o niezwłoczne uzupełnienie raportu w aplikacji. Brak raportu może skutkować blokadą konta.
    </p>
    <div style="margin-top: 24px;">
      <a href="https://app.base44.com" style="display: inline-block; background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
        Uzupełnij raport →
      </a>
    </div>
  </div>
  <div style="padding: 18px 30px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb;">
    To powiadomienie zostało wysłane z aplikacji 4-ECO Green Energy
  </div>
</div>
`;

// Parsuje datę w formacie "YYYY-MM-DD" lub "DD.MM.YYYY"
function parseDate(str) {
  if (!str) return null;
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
  const plMatch = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (plMatch) return new Date(parseInt(plMatch[3]), parseInt(plMatch[2]) - 1, parseInt(plMatch[1]));
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const pastLimit = new Date(today);
    pastLimit.setDate(pastLimit.getDate() - 30); // max 30 dni wstecz

    const [assignments, meetingReports, notifications] = await Promise.all([
      base44.asServiceRole.entities.MeetingAssignment.list(),
      base44.asServiceRole.entities.MeetingReport.list(),
      base44.asServiceRole.entities.Notification.list(),
    ]);

    let sent = 0;

    for (const assignment of assignments) {
      if (!assignment.meeting_date || !assignment.assigned_user_email) continue;

      const meetingDay = parseDate(assignment.meeting_date);
      if (!meetingDay) continue;

      // Tylko przeszłe spotkania (do 30 dni wstecz), nie dzisiejsze
      const diffDays = Math.floor((today - meetingDay) / 86400000);
      if (diffDays <= 0 || diffDays > 30) continue;

      // Sprawdź czy raport już istnieje
      const reportExists = meetingReports.some(r => {
        const nameMatch = (r.client_name || '').toLowerCase().trim() === (assignment.client_name || '').toLowerCase().trim();
        const authorMatch = r.author_email === assignment.assigned_user_email || r.created_by === assignment.assigned_user_email;
        return nameMatch && authorMatch;
      });

      if (reportExists) continue;

      // Sprawdź czy dziś już wysłano powiadomienie dla tego spotkania
      const todayStr = today.toISOString().split('T')[0];
      const alreadySentToday = notifications.some(n =>
        n.user_email === assignment.assigned_user_email &&
        n.type === 'system_error' &&
        n.message?.includes(assignment.client_name) &&
        n.message?.includes(assignment.meeting_date) &&
        n.created_date?.startsWith(todayStr)
      );

      if (alreadySentToday) continue;

      // Utwórz powiadomienie w aplikacji
      await base44.asServiceRole.entities.Notification.create({
        user_email: assignment.assigned_user_email,
        type: 'system_error',
        title: '⚠️ Brak raportu po spotkaniu',
        message: `Nie uzupełniono raportu po spotkaniu z klientem ${assignment.client_name} (${assignment.meeting_date}). Opóźnienie: ${diffDays} ${diffDays === 1 ? 'dzień' : 'dni'}. Uzupełnij raport natychmiast!`,
        is_read: false,
      });

      // Wyślij email
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: assignment.assigned_user_email,
          subject: `⚠️ Brak raportu po spotkaniu – ${assignment.client_name} (${diffDays} ${diffDays === 1 ? 'dzień' : 'dni'} opóźnienia)`,
          body: emailTemplate(assignment.client_name, assignment.meeting_date, diffDays),
        });
      } catch (_) { /* ignoruj błąd email */ }

      sent++;
    }

    return Response.json({ ok: true, checked: assignments.length, sent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});