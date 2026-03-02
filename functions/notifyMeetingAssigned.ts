import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { assignedUserEmail, assignedUserName, clientName, meetingCalendar, sheet } = await req.json();

    // Utwórz powiadomienie in-app
    await base44.asServiceRole.entities.Notification.create({
      user_email: assignedUserEmail,
      type: 'new_report',
      title: '📅 Nowe spotkanie przypisane',
      message: `Masz nowe spotkanie z klientem ${clientName} (${sheet}) zaplanowane na ${meetingCalendar}. Pamiętaj o raporcie po spotkaniu!`,
      is_read: false,
    });

    // Wyślij email
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: assignedUserEmail,
      subject: `Nowe spotkanie: ${clientName} – ${meetingCalendar}`,
      body: `Cześć ${assignedUserName}!\n\nZostało Ci przypisane nowe spotkanie:\n\nKlient: ${clientName}\nArkusz: ${sheet}\nData i godzina: ${meetingCalendar}\n\nPamiętaj, że po spotkaniu należy uzupełnić raport w aplikacji.\n\nPozdrawiamy,\n4-ECO Green Energy`,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});