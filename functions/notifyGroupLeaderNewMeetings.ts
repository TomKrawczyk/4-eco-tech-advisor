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

// Wywoływana przez automation lub ręcznie – wysyła powiadomienia do group leaderów o nowych spotkaniach
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Opcjonalny parametr: wysyłka tylko do konkretnej grupy
    let filterGroupId = null;
    try {
      const body = await req.clone().json();
      filterGroupId = body?.groupId || null;
    } catch (_) {}

    const [allowedUsers, allGroups, sheetMappings, allAssignments] = await Promise.all([
      base44.asServiceRole.entities.AllowedUser.list(),
      base44.asServiceRole.entities.Group.list(),
      base44.asServiceRole.entities.SheetGroupMapping.list(),
      base44.asServiceRole.entities.MeetingAssignment.list(),
    ]);

    const groups = filterGroupId ? allGroups.filter(g => g.id === filterGroupId) : allGroups;

    // Spotkania nieprzypisane do żadnego handlowca
    const unassignedMeetings = allAssignments.filter(m => !m.assigned_user_email);

    if (unassignedMeetings.length === 0) {
      return Response.json({ ok: true, message: 'Brak nieprzypisanych spotkań' });
    }

    // Dla każdej grupy: znajdź jej group leaderów i spotkania z przypisanych arkuszy
    const notified = [];

    for (const group of groups) {
      const groupId = group.id;
      const groupName = group.data?.name || group.name;

      // Arkusze przypisane do tej grupy
      const groupSheets = sheetMappings
        .filter(sm => sm.group_id === groupId && sm.is_active !== false)
        .map(sm => sm.sheet_name);

      if (groupSheets.length === 0) continue;

      // Nieprzypisane spotkania z tych arkuszy
      const groupMeetings = unassignedMeetings.filter(m => groupSheets.includes(m.sheet));
      if (groupMeetings.length === 0) continue;

      // Znajdź group leaderów tej grupy
      const leaderIds = group.data?.group_leader_ids || group.group_leader_ids || [];
      const legacyLeaderId = group.data?.group_leader_id || group.group_leader_id;
      const allLeaderIds = legacyLeaderId ? [...new Set([...leaderIds, legacyLeaderId])] : leaderIds;

      const leaders = allowedUsers.filter(u => allLeaderIds.includes(u.id));

      for (const leader of leaders) {
        const leaderEmail = leader.data?.email || leader.email;
        const leaderName = leader.data?.name || leader.name;
        if (!leaderEmail) continue;

        // Powiadomienie in-app
        await base44.asServiceRole.entities.Notification.create({
          user_email: leaderEmail,
          type: 'user_activity',
          title: `📋 Nowe spotkania do przypisania (${groupName})`,
          message: `W arkuszach Twojej grupy pojawiło się ${groupMeetings.length} spotkań do przypisania handlowcom.`,
          is_read: false,
        });

        // Email
        try {
          const meetingList = groupMeetings.slice(0, 10).map(m => {
            const name = m.data?.client_name || m.client_name || '?';
            const cal = m.data?.meeting_calendar || m.meeting_calendar || '';
            const sheet = m.data?.sheet || m.sheet || '';
            return `• ${name}${cal ? ' – ' + cal : ''} (${sheet})`;
          }).join('\n');
          const moreText = groupMeetings.length > 10 ? `\n...i ${groupMeetings.length - 10} więcej.` : '';

          await sendBrevoEmail({
            to: leaderEmail,
            toName: leaderName,
            subject: `Nowe spotkania do przypisania – ${groupName} (${groupMeetings.length})`,
            text: `Cześć ${leaderName}!\n\nW arkuszach Twojej grupy "${groupName}" oczekuje ${groupMeetings.length} spotkań do przypisania handlowcom:\n\n${meetingList}${moreText}\n\nZaloguj się do aplikacji, aby przypisać spotkania do handlowców.\n\nPozdrawiamy,\n4-ECO Green Energy`,
          });
          notified.push(leaderEmail);
        } catch (emailErr) {
          console.error("Błąd wysyłki email Brevo:", emailErr.message);
        }
      }
    }

    return Response.json({ ok: true, notified });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});