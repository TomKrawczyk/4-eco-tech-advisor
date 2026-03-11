import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

async function sendBrevoEmail({ to, toName, subject, text }) {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: { name: "4-ECO Green Energy", email: "noreply@mail4eco.pl" },
      to: [{ email: to, name: toName || to }],
      subject,
      textContent: text,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo error: ${err}`);
  }
}

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

    // Wyślij email przez Brevo
    try {
      await sendBrevoEmail({
        to: assignedUserEmail,
        toName: assignedUserName,
        subject: `Nowe spotkanie: ${clientName} – ${meetingCalendar}`,
        text: `Cześć ${assignedUserName}!\n\nZostało Ci przypisane nowe spotkanie:\n\nKlient: ${clientName}\nArkusz: ${sheet}\nData i godzina: ${meetingCalendar}\n\nPamiętaj, że po spotkaniu należy uzupełnić raport w aplikacji.\n\nPozdrawiamy,\n4-ECO Green Energy`,
      });
    } catch (emailErr) {
      console.error("Błąd wysyłki email Brevo:", emailErr.message);
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});