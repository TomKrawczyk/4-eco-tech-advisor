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
      sender: { name: "4-ECO Green Energy", email: "noreply@4-eco.pl" },
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

    const { assignedUserEmail, assignedUserName, clientName, phone, sheet } = await req.json();

    // Powiadomienie in-app
    await base44.asServiceRole.entities.Notification.create({
      user_email: assignedUserEmail,
      type: 'new_report',
      title: '📞 Nowy kontakt telefoniczny przypisany',
      message: `Masz nowy kontakt telefoniczny do obsłużenia: ${clientName}${phone ? ' (' + phone + ')' : ''} z arkusza ${sheet}.`,
      is_read: false,
    });

    // Email przez Brevo
    try {
      await sendBrevoEmail({
        to: assignedUserEmail,
        toName: assignedUserName,
        subject: `Nowy kontakt telefoniczny: ${clientName}`,
        text: `Cześć ${assignedUserName}!\n\nZostał Ci przypisany nowy kontakt telefoniczny do obsłużenia:\n\nKlient: ${clientName}${phone ? '\nTelefon: ' + phone : ''}\nArkusz: ${sheet}\n\nZaloguj się do aplikacji, aby zobaczyć szczegóły.\n\nPozdrawiamy,\n4-ECO Green Energy`,
      });
    } catch (emailErr) {
      console.error("Błąd wysyłki email Brevo:", emailErr.message);
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});