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

// Wysyła powiadomienie do group leaderów gdy kontakt telefoniczny zostaje przypisany do ich grupy
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch (_) {}
    const { groupId, groupName, clientName, phone, sheet, bulkMode } = body;

    if (!groupId) return Response.json({ ok: true, message: 'Brak groupId' });

    // Pobierz grupę i jej leaderów
    const groups = await base44.asServiceRole.entities.Group.list();
    const group = groups.find(g => g.id === groupId);
    if (!group) return Response.json({ ok: true, message: 'Nie znaleziono grupy' });

    const leaderIds = group.data?.group_leader_ids || group.group_leader_ids || [];
    const legacyLeaderId = group.data?.group_leader_id || group.group_leader_id;
    const allLeaderIds = legacyLeaderId ? [...new Set([...leaderIds, legacyLeaderId])] : leaderIds;

    if (allLeaderIds.length === 0) return Response.json({ ok: true, message: 'Brak leaderów w grupie' });

    const allowedUsers = await base44.asServiceRole.entities.AllowedUser.list();
    const leaders = allowedUsers.filter(u => allLeaderIds.includes(u.id));

    const notified = [];
    for (const leader of leaders) {
      const leaderEmail = leader.data?.email || leader.email;
      const leaderName = leader.data?.name || leader.name;
      if (!leaderEmail) continue;

      // Powiadomienie in-app
      await base44.asServiceRole.entities.Notification.create({
        user_email: leaderEmail,
        type: 'user_activity',
        title: `📞 Nowy kontakt przypisany do grupy ${groupName}`,
        message: `Kontakt telefoniczny ${clientName}${phone ? ' (' + phone + ')' : ''} z arkusza ${sheet} został przypisany do Twojej grupy.`,
        is_read: false,
      });

      // Email
      try {
        await sendBrevoEmail({
          to: leaderEmail,
          toName: leaderName,
          subject: `Nowy kontakt telefoniczny dla grupy ${groupName}: ${clientName}`,
          text: `Cześć ${leaderName}!\n\nNowy kontakt telefoniczny został przypisany do Twojej grupy "${groupName}":\n\nKlient: ${clientName}${phone ? '\nTelefon: ' + phone : ''}\nArkusz: ${sheet}\n\nZaloguj się do aplikacji, aby przypisać kontakt do doradcy.\n\nPozdrawiamy,\n4-ECO Green Energy`,
        });
        notified.push(leaderEmail);
      } catch (emailErr) {
        console.error("Błąd wysyłki email:", emailErr.message);
      }
    }

    return Response.json({ ok: true, notified });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});