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

    // W trybie bulkMode pobieramy wszystkie kontakty z bazy dla tej grupy
    let bulkContacts = [];
    if (bulkMode) {
      const allContacts = await base44.asServiceRole.entities.PhoneContact.list();
      bulkContacts = allContacts.filter(c => c.assigned_group_id === groupId);
    }

    const notified = [];
    for (const leader of leaders) {
      const leaderEmail = leader.data?.email || leader.email;
      const leaderName = leader.data?.name || leader.name;
      if (!leaderEmail) continue;

      const isBulk = bulkMode && bulkContacts.length > 0;
      const notifTitle = isBulk
        ? `📞 Nowe kontakty telefoniczne (${groupName}) – ${bulkContacts.length}`
        : `📞 Nowy kontakt przypisany do grupy ${groupName}`;
      const notifMessage = isBulk
        ? `W Twojej grupie "${groupName}" jest ${bulkContacts.length} kontaktów telefonicznych do obsługi.`
        : `Kontakt telefoniczny ${clientName}${phone ? ' (' + phone + ')' : ''} z arkusza ${sheet} został przypisany do Twojej grupy.`;

      await base44.asServiceRole.entities.Notification.create({
        user_email: leaderEmail,
        type: 'user_activity',
        title: notifTitle,
        message: notifMessage,
        is_read: false,
      });

      try {
        let emailSubject, emailText;
        if (isBulk) {
          const list = bulkContacts.slice(0, 10).map(c =>
            `• ${c.client_name}${c.phone ? ' – ' + c.phone : ''}${c.sheet ? ' (' + c.sheet + ')' : ''}`
          ).join('\n');
          const more = bulkContacts.length > 10 ? `\n...i ${bulkContacts.length - 10} więcej.` : '';
          emailSubject = `Kontakty telefoniczne do przypisania – ${groupName} (${bulkContacts.length})`;
          emailText = `Cześć ${leaderName}!\n\nW Twojej grupie "${groupName}" jest ${bulkContacts.length} kontaktów telefonicznych oczekujących na przypisanie do doradców:\n\n${list}${more}\n\nZaloguj się do aplikacji, aby przypisać kontakty.\n\nPozdrawiamy,\n4-ECO Green Energy`;
        } else {
          emailSubject = `Nowy kontakt telefoniczny dla grupy ${groupName}: ${clientName}`;
          emailText = `Cześć ${leaderName}!\n\nNowy kontakt telefoniczny został przypisany do Twojej grupy "${groupName}":\n\nKlient: ${clientName}${phone ? '\nTelefon: ' + phone : ''}\nArkusz: ${sheet}\n\nZaloguj się do aplikacji, aby przypisać kontakt do doradcy.\n\nPozdrawiamy,\n4-ECO Green Energy`;
        }
        await sendBrevoEmail({ to: leaderEmail, toName: leaderName, subject: emailSubject, text: emailText });
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