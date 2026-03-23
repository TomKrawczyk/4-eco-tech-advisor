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

    const messageForUser = `Masz nowe spotkanie z klientem ${clientName} (${sheet}) zaplanowane na ${meetingCalendar}. Pamiętaj o raporcie po spotkaniu!`;

    // Pobierz dane użytkownika i jego lidera równolegle
    const [allowedUsers, groups] = await Promise.all([
      base44.asServiceRole.entities.AllowedUser.list(),
      base44.asServiceRole.entities.Group.list(),
    ]);

    const assignedAllowedUser = allowedUsers.find(u => (u.data?.email || u.email) === assignedUserEmail);
    const userGroupId = assignedAllowedUser?.data?.group_id || assignedAllowedUser?.group_id;

    // Znajdź group lidera (lub team lidera przypisanego do handlowca)
    const leaderEmails = new Set();

    // Team leader (assigned_to)
    const assignedToId = assignedAllowedUser?.data?.assigned_to || assignedAllowedUser?.assigned_to;
    if (assignedToId) {
      const teamLeader = allowedUsers.find(u => u.id === assignedToId);
      if (teamLeader) {
        const tlEmail = teamLeader.data?.email || teamLeader.email;
        if (tlEmail && tlEmail !== assignedUserEmail) leaderEmails.add({ email: tlEmail, name: teamLeader.data?.name || teamLeader.name, role: 'team_leader' });
      }
    }

    // Group leaderzy grupy
    if (userGroupId) {
      const group = groups.find(g => g.id === userGroupId);
      if (group) {
        const glIds = [...(group.data?.group_leader_ids || group.group_leader_ids || [])];
        const legacyId = group.data?.group_leader_id || group.group_leader_id;
        if (legacyId) glIds.push(legacyId);
        const groupName = group.data?.name || group.name;
        for (const glId of [...new Set(glIds)]) {
          const gl = allowedUsers.find(u => u.id === glId);
          if (gl) {
            const glEmail = gl.data?.email || gl.email;
            if (glEmail && glEmail !== assignedUserEmail) leaderEmails.add({ email: glEmail, name: gl.data?.name || gl.name, groupName });
          }
        }
      }
    }

    const leaderMessage = `${assignedUserName} został przypisany do spotkania z klientem ${clientName} (${sheet}) na ${meetingCalendar}.`;

    // Wyślij powiadomienia równolegle: handlowiec + liderzy
    await Promise.all([
      // Do handlowca
      base44.asServiceRole.entities.Notification.create({
        user_email: assignedUserEmail,
        type: 'new_report',
        title: '📅 Nowe spotkanie przypisane',
        message: messageForUser,
        is_read: false,
      }),
      sendBrevoEmail({
        to: assignedUserEmail,
        toName: assignedUserName,
        subject: '📅 Nowe spotkanie przypisane – 4-ECO',
        text: `Cześć ${assignedUserName},\n\n${messageForUser}\n\nZaloguj się do aplikacji, aby zobaczyć szczegóły.\n\nPozdrawiamy,\n4-ECO Green Energy`,
      }),
      // Do liderów
      ...[...leaderEmails].map(({ email, name, groupName }) =>
        Promise.all([
          base44.asServiceRole.entities.Notification.create({
            user_email: email,
            type: 'user_activity',
            title: '📅 Spotkanie przypisane w Twoim zespole',
            message: leaderMessage,
            is_read: false,
          }),
          sendBrevoEmail({
            to: email,
            toName: name || email,
            subject: '📅 Przypisanie spotkania – 4-ECO',
            text: `Cześć ${name || ''},\n\n${leaderMessage}\n\nZaloguj się do aplikacji, aby zobaczyć szczegóły.\n\nPozdrawiamy,\n4-ECO Green Energy`,
          }),
        ])
      ),
    ]);

    return Response.json({ ok: true, notifiedLeaders: [...leaderEmails].map(l => l.email) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});