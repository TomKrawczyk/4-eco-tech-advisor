import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Dni po których wysyłamy przypomnienie
const REMIND_AFTER_DAYS = 3;
// Dni po których blokujemy konto
const BLOCK_AFTER_DAYS = 7;

const reminderEmailTemplate = (clientName, assignedDate, daysAgo) => `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
  <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 24px 30px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 22px;">⚠️ 4-ECO Green Energy</h1>
    <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0 0; font-size: 14px;">Przypomnienie o kontakcie telefonicznym</p>
  </div>
  <div style="padding: 32px 30px; background: #f9fafb;">
    <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 18px;">Brak kontaktu telefonicznego z klientem</h2>
    <p style="color: #4b5563; line-height: 1.7; margin: 0 0 10px 0;">Nie odnotowano kontaktu telefonicznego z klientem:</p>
    <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px 20px; margin: 16px 0;">
      <p style="margin: 0 0 8px 0; color: #1f2937;"><strong>Klient:</strong> ${clientName}</p>
      <p style="margin: 0 0 8px 0; color: #1f2937;"><strong>Data przypisania:</strong> ${assignedDate}</p>
      <p style="margin: 0; color: #f97316;"><strong>Czas od przypisania:</strong> ${daysAgo} ${daysAgo === 1 ? 'dzień' : 'dni'}</p>
    </div>
    <p style="color: #4b5563; line-height: 1.7; margin: 0 0 20px 0;">
      Prosimy o niezwłoczne nawiązanie kontaktu i zaraportowanie go w aplikacji.
      ${daysAgo >= BLOCK_AFTER_DAYS 
        ? '<strong style="color:#ef4444;">Twoje konto zostało zablokowane z powodu braku kontaktu i raportu.</strong>' 
        : `Brak kontaktu przez ${BLOCK_AFTER_DAYS} dni od przypisania skutkuje blokadą konta.`}
    </p>
    <div style="margin-top: 24px;">
      <a href="https://4-ecodoradca.base44.app/PhoneContacts" style="display: inline-block; background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
        Przejdź do kontaktów →
      </a>
    </div>
  </div>
  <div style="padding: 18px 30px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb;">
    To powiadomienie zostało wysłane z aplikacji 4-ECO Green Energy
  </div>
</div>
`;

const groupLeaderEmailTemplate = (groupName, clientName, assignedDate, daysAgo) => `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
  <div style="background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); padding: 24px 30px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 22px;">⚠️ 4-ECO Green Energy</h1>
    <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0 0; font-size: 14px;">Alert lidera grupy – brak kontaktu z klientem</p>
  </div>
  <div style="padding: 32px 30px; background: #f9fafb;">
    <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 18px;">Kontakt w grupie "${groupName}" bez obsługi</h2>
    <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px 20px; margin: 16px 0;">
      <p style="margin: 0 0 8px 0; color: #1f2937;"><strong>Klient:</strong> ${clientName}</p>
      <p style="margin: 0 0 8px 0; color: #1f2937;"><strong>Data przypisania:</strong> ${assignedDate}</p>
      <p style="margin: 0; color: #7c3aed;"><strong>Czas od przypisania:</strong> ${daysAgo} ${daysAgo === 1 ? 'dzień' : 'dni'}</p>
    </div>
    <p style="color: #4b5563;">Kontakt telefoniczny przypisany do Twojej grupy nie został jeszcze wykonany i zaraportowany.</p>
  </div>
</div>
`;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayStr = today.toISOString().split('T')[0];

    const [phoneContacts, phoneContactReports, allowedUsers, groups, notifications] = await Promise.all([
      base44.asServiceRole.entities.PhoneContact.list(),
      base44.asServiceRole.entities.PhoneContactReport.list(),
      base44.asServiceRole.entities.AllowedUser.list(),
      base44.asServiceRole.entities.Group.list(),
      base44.asServiceRole.entities.Notification.list(),
    ]);

    // Zwolnieni z raportowania + role nie będące doradcami
    const EXEMPT_ROLES = new Set(['admin', 'group_leader', 'team_leader', 'hr_admin', 'test_user', 'serviceman', 'auditor']);
    const exemptEmails = new Set(
      allowedUsers
        .filter(u => {
          const role = u.data?.role || u.role;
          return (u.data?.exempt_from_reports || u.exempt_from_reports) || EXEMPT_ROLES.has(role);
        })
        .map(u => u.data?.email || u.email)
    );

    const normalizePhone = p => (p || '').replace(/\s+/g, '').replace(/[^\d]/g, '');
    const normalizeStr = s => (s || '').toLowerCase().trim().replace(/\s+/g, ' ');

    // Kontakty przypisane do konkretnego użytkownika (nie grupy)
    const assignedToUser = phoneContacts.filter(c => c.assigned_user_email);

    // Kontakty przypisane tylko do grupy (bez konkretnego doradcy)
    const assignedToGroupOnly = phoneContacts.filter(c => c.assigned_group_id && !c.assigned_user_email);

    // Sprawdź czy kontakt ma raport
    const hasReport = (contact) => {
      const cPhone = normalizePhone(contact.phone || contact.client_phone);
      const cName = normalizeStr(contact.client_name);
      return phoneContactReports.some(r => {
        const rPhone = normalizePhone(r.client_phone);
        const rName = normalizeStr(r.client_name);
        const phoneMatch = cPhone.length >= 7 && rPhone.length >= 7 && cPhone === rPhone;
        const nameMatch = rName === cName || (rName.length > 2 && cName.startsWith(rName)) || (cName.length > 2 && rName.startsWith(cName));
        return phoneMatch || nameMatch;
      });
    };

    // Oblicz dni od przypisania
    const daysSinceAssigned = (contact) => {
      const assignedDate = contact.updated_date || contact.created_date;
      if (!assignedDate) return 0;
      const d = new Date(assignedDate);
      const assigned = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      return Math.floor((today - assigned) / 86400000);
    };

    let notifsSent = 0;
    let usersBlocked = 0;
    let usersUnblocked = 0;

    // --- Obsługa kontaktów przypisanych do użytkowników ---
    const missingByUser = {}; // email -> [{contact, daysAgo}]

    for (const contact of assignedToUser) {
      const email = contact.assigned_user_email;
      if (!email || exemptEmails.has(email)) continue;
      if (hasReport(contact)) continue;

      const daysAgo = daysSinceAssigned(contact);
      if (daysAgo < REMIND_AFTER_DAYS) continue; // Za wcześnie

      if (!missingByUser[email]) missingByUser[email] = [];
      missingByUser[email].push({ contact, daysAgo });
    }

    for (const [email, missing] of Object.entries(missingByUser)) {
      const maxDays = Math.max(...missing.map(m => m.daysAgo));
      const shouldBlock = maxDays >= BLOCK_AFTER_DAYS;

      const ua = allowedUsers.find(u => (u.data?.email || u.email) === email);
      if (ua) {
        const currentlyBlocked = ua.data?.is_blocked || ua.is_blocked || false;
        if (shouldBlock && !currentlyBlocked) {
          await base44.asServiceRole.entities.AllowedUser.update(ua.id, {
            is_blocked: true,
            blocked_reason: `Brak kontaktu telefonicznego z ${missing.length} klientami (max: ${maxDays} dni od przypisania)`,
            missing_reports_count: (ua.missing_reports_count || 0) + missing.length,
          });
          usersBlocked++;
        } else if (!shouldBlock && currentlyBlocked) {
          // Nie odblokowujemy tutaj – może być zablokowany też za brak raportów po spotkaniach
        }
      }

      // Powiadomienia – raz dziennie
      for (const { contact, daysAgo } of missing) {
        const alreadySentToday = notifications.some(n =>
          n.user_email === email &&
          n.type === 'system_error' &&
          n.message?.includes(contact.client_name) &&
          n.message?.includes('kontakt telefoniczny') &&
          n.created_date?.startsWith(todayStr)
        );
        if (alreadySentToday) continue;

        const assignedDateStr = (contact.updated_date || contact.created_date || '').split('T')[0];
        const isBlock = daysAgo >= BLOCK_AFTER_DAYS;

        await base44.asServiceRole.entities.Notification.create({
          user_email: email,
          type: 'system_error',
          title: isBlock ? '🔒 Konto zablokowane – brak kontaktu telefonicznego' : '⚠️ Brak kontaktu telefonicznego z klientem',
          message: `Nie zaraportowano kontaktu telefonicznego z klientem ${contact.client_name}. Czas od przypisania: ${daysAgo} ${daysAgo === 1 ? 'dzień' : 'dni'}.${isBlock ? ' 🔒 KONTO ZABLOKOWANE.' : ` Blokada nastąpi po ${BLOCK_AFTER_DAYS} dniach.`}`,
          is_read: false,
        });

        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: email,
            subject: `${isBlock ? '🔒 Konto zablokowane' : '⚠️ Brak kontaktu'} – ${contact.client_name} (${daysAgo} dni)`,
            body: reminderEmailTemplate(contact.client_name, assignedDateStr, daysAgo),
          });
        } catch (_) {}

        notifsSent++;
      }
    }

    // Odblokuj użytkowników którzy zaraportowali wszystkie kontakty telefoniczne (jeśli blokada tylko z tego powodu)
    for (const ua of allowedUsers) {
      const email = ua.data?.email || ua.email;
      const currentlyBlocked = ua.data?.is_blocked || ua.is_blocked || false;
      if (!currentlyBlocked) continue;
      if (missingByUser[email]) continue; // nadal ma braki kontaktów

      // Sprawdź czy ma też braki raportów spotkań – jeśli tak, nie odblokowuj
      // (to zrobi checkMissingMeetingReports)
      // Tutaj tylko aktualizujemy jeśli blokada była tylko z powodu kontaktów
      const blockedReason = ua.data?.blocked_reason || ua.blocked_reason || '';
      if (blockedReason.includes('kontakt telefoniczny') && !blockedReason.includes('spotkani')) {
        await base44.asServiceRole.entities.AllowedUser.update(ua.id, {
          is_blocked: false,
          blocked_reason: '',
          missing_reports_count: 0,
        });
        usersUnblocked++;
      }
    }

    // --- Obsługa kontaktów przypisanych do grupy (bez doradcy) → powiadamiaj liderów ---
    const groupContactsUnhandled = {};

    for (const contact of assignedToGroupOnly) {
      if (hasReport(contact)) continue;
      const daysAgo = daysSinceAssigned(contact);
      if (daysAgo < REMIND_AFTER_DAYS) continue;

      const gid = contact.assigned_group_id;
      if (!gid) continue;
      if (!groupContactsUnhandled[gid]) groupContactsUnhandled[gid] = [];
      groupContactsUnhandled[gid].push({ contact, daysAgo });
    }

    for (const [groupId, items] of Object.entries(groupContactsUnhandled)) {
      const group = groups.find(g => g.id === groupId);
      if (!group) continue;

      // Znajdź liderów grupy
      const leaderIds = group.group_leader_ids || (group.group_leader_id ? [group.group_leader_id] : []);
      const leaderEmails = allowedUsers
        .filter(u => leaderIds.includes(u.id))
        .map(u => u.data?.email || u.email)
        .filter(Boolean);

      for (const leaderEmail of leaderEmails) {
        // Czy lider jest zablokowany już? Jeśli nie – sprawdź czy należy zablokować
        const maxDays = Math.max(...items.map(m => m.daysAgo));
        const shouldBlock = maxDays >= BLOCK_AFTER_DAYS;
        const ua = allowedUsers.find(u => (u.data?.email || u.email) === leaderEmail);

        if (ua && shouldBlock) {
          const currentlyBlocked = ua.data?.is_blocked || ua.is_blocked || false;
          if (!currentlyBlocked) {
            await base44.asServiceRole.entities.AllowedUser.update(ua.id, {
              is_blocked: true,
              blocked_reason: `Brak obsługi ${items.length} kontaktów telefonicznych w grupie "${group.name}" (max: ${maxDays} dni)`,
              missing_reports_count: items.length,
            });
            usersBlocked++;
          }
        }

        // Powiadamiaj lidera – raz dziennie per klient
        for (const { contact, daysAgo } of items) {
          const alreadySentToday = notifications.some(n =>
            n.user_email === leaderEmail &&
            n.type === 'system_error' &&
            n.message?.includes(contact.client_name) &&
            n.message?.includes('grupy') &&
            n.created_date?.startsWith(todayStr)
          );
          if (alreadySentToday) continue;

          const isBlock = daysAgo >= BLOCK_AFTER_DAYS;
          await base44.asServiceRole.entities.Notification.create({
            user_email: leaderEmail,
            type: 'system_error',
            title: isBlock ? `🔒 Blokada – kontakt w grupie nieobsłużony` : `⚠️ Kontakt w grupie "${group.name}" bez obsługi`,
            message: `Klient ${contact.client_name} przypisany do grupy "${group.name}" nie ma zaraportowanego kontaktu telefonicznego od ${daysAgo} ${daysAgo === 1 ? 'dnia' : 'dni'}.`,
            is_read: false,
          });

          try {
            const assignedDateStr = (contact.updated_date || contact.created_date || '').split('T')[0];
            await base44.asServiceRole.integrations.Core.SendEmail({
              to: leaderEmail,
              subject: `⚠️ Brak kontaktu w grupie "${group.name}" – ${contact.client_name} (${daysAgo} dni)`,
              body: groupLeaderEmailTemplate(group.name, contact.client_name, assignedDateStr, daysAgo),
            });
          } catch (_) {}

          notifsSent++;
        }
      }
    }

    return Response.json({ ok: true, notifsSent, usersBlocked, usersUnblocked });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});