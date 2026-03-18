import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Dni opóźnienia po których następuje blokada
const BLOCK_AFTER_DAYS = 3;

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
      Prosimy o niezwłoczne uzupełnienie raportu w aplikacji.
      ${daysAgo >= BLOCK_AFTER_DAYS ? '<strong style="color:#ef4444;">Twoje konto zostało zablokowane z powodu braku raportowania.</strong>' : `Brak raportu przez ${BLOCK_AFTER_DAYS} dni skutkuje blokadą konta.`}
    </p>
    <div style="margin-top: 24px;">
      <a href="https://4-ecodoradca.base44.app/MeetingReports" style="display: inline-block; background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
        Uzupełnij raport →
      </a>
    </div>
  </div>
  <div style="padding: 18px 30px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb;">
    To powiadomienie zostało wysłane z aplikacji 4-ECO Green Energy
  </div>
</div>
`;

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
    pastLimit.setDate(pastLimit.getDate() - 30);
    const todayStr = today.toISOString().split('T')[0];

    const [assignments, meetingReports, visitReports, notifications, allowedUsers, calendarEvents] = await Promise.all([
      base44.asServiceRole.entities.MeetingAssignment.list(),
      base44.asServiceRole.entities.MeetingReport.list(),
      base44.asServiceRole.entities.VisitReport.list(),
      base44.asServiceRole.entities.Notification.list(),
      base44.asServiceRole.entities.AllowedUser.list(),
      base44.asServiceRole.entities.CalendarEvent.list(),
    ]);

    // Zbiór wydarzeń przełożonych (status=postponed) z nową datą w przyszłości
    // Jeśli spotkanie jest przełożone na datę w przyszłości → nie wymagamy raportu
    const postponedKeys = new Set();
    for (const ev of calendarEvents) {
      if (ev.status !== 'postponed') continue;
      const postponedTo = ev.postponed_to;
      if (!postponedTo) continue;
      const newDay = parseDate(postponedTo);
      if (!newDay) continue;
      if (newDay > today) {
        // Klucz: email właściciela + znormalizowany telefon lub nazwa klienta
        const phone = (ev.client_phone || '').replace(/\s+/g, '').replace(/[^\d]/g, '');
        const name = (ev.client_name || '').toLowerCase().trim();
        const clientKey = phone.length >= 7 ? phone : name;
        if (clientKey && ev.owner_email) {
          postponedKeys.add(`${ev.owner_email}|${clientKey}`);
        }
      }
    }

    // Łączymy oba typy raportów jako dowód spotkania
    const allReports = [
      ...meetingReports.map(r => ({ ...r, _source: 'meeting' })),
      ...visitReports.map(r => ({ ...r, _source: 'visit' })),
    ];

    const normalizePhone = p => (p || '').replace(/\s+/g, '').replace(/[^\d]/g, '');
    const normalizeStr = s => (s || '').toLowerCase().trim().replace(/\s+/g, ' ');

    // Deduplikacja: dla każdego użytkownika i klienta bierz tylko NAJNOWSZE przypisanie
    // Jeśli spotkanie zostało przełożone na przyszłość, nie wymagamy raportu
    const dedupedAssignments = (() => {
      const map = new Map(); // key: email|phone_or_name -> najnowsze assignment
      for (const a of assignments) {
        if (!a.assigned_user_email) continue;
        const phone = normalizePhone(a.client_phone);
        const name = normalizeStr(a.client_name);
        const clientKey = phone.length >= 7 ? phone : name;
        const key = `${a.assigned_user_email}|${clientKey}`;
        const existing = map.get(key);
        const thisDate = parseDate(a.meeting_date);
        const existDate = existing ? parseDate(existing.meeting_date) : null;
        if (!existing || (thisDate && existDate && thisDate > existDate)) {
          map.set(key, a);
        }
      }
      return Array.from(map.values());
    })();

    // Grupuj brakujące raporty wg użytkownika
    const missingByUser = {}; // email -> [{assignment, diffDays}]

    for (const assignment of dedupedAssignments) {
      if (!assignment.meeting_date || !assignment.assigned_user_email) continue;

      const meetingDay = parseDate(assignment.meeting_date);
      if (!meetingDay) continue;

      const diffDays = Math.floor((today - meetingDay) / 86400000);
      if (diffDays <= 0) continue; // tylko przeszłe (przyszłe/dzisiejsze → brak wymogu raportu)

      // Pomiń jeśli spotkanie zostało przełożone na datę w przyszłości
      const pPhone = (assignment.client_phone || '').replace(/\s+/g, '').replace(/[^\d]/g, '');
      const pName = (assignment.client_name || '').toLowerCase().trim();
      const pKey = pPhone.length >= 7 ? pPhone : pName;
      if (pKey && postponedKeys.has(`${assignment.assigned_user_email}|${pKey}`)) continue;

      const normalize = s => (s || '').toLowerCase().trim().replace(/\s+/g, ' ').replace(/\s*-\s*/g, '-');
      const aName = normalize(assignment.client_name);
      const aPhone = normalizePhone(assignment.client_phone);

      const reportExists = allReports.some(r => {
        const authorMatch = r.author_email === assignment.assigned_user_email;
        if (!authorMatch) return false;

        const rName = normalize(r.client_name);
        const rPhone = normalizePhone(r.client_phone);

        // Dopasowanie po telefonie LUB po nazwie
        const phoneMatch = aPhone.length >= 7 && rPhone.length >= 7 && aPhone === rPhone;
        const nameMatch = rName === aName || (rName.length > 2 && aName.startsWith(rName)) || (aName.length > 2 && rName.startsWith(aName));

        return phoneMatch || nameMatch;
      });

      if (reportExists) continue;

      const email = assignment.assigned_user_email;
      if (!missingByUser[email]) missingByUser[email] = [];
      missingByUser[email].push({ assignment, diffDays });
    }

    let notifsSent = 0;
    let usersBlocked = 0;
    let usersUnblocked = 0;

    // Przetwarzaj każdego użytkownika z brakującymi raportami
    for (const [email, missing] of Object.entries(missingByUser)) {
      const maxDays = Math.max(...missing.map(m => m.diffDays));
      const shouldBlock = maxDays >= BLOCK_AFTER_DAYS;

      // Zaktualizuj flagę blokady w AllowedUser
      const ua = allowedUsers.find(u => (u.data?.email || u.email) === email);
      if (ua) {
        const currentlyBlocked = ua.data?.is_blocked || ua.is_blocked || false;
        if (shouldBlock && !currentlyBlocked) {
          await base44.asServiceRole.entities.AllowedUser.update(ua.id, {
            is_blocked: true,
            blocked_reason: `Brak raportów po ${missing.length} spotkaniach (max opóźnienie: ${maxDays} dni)`,
            missing_reports_count: missing.length,
          });
          usersBlocked++;
        } else if (!shouldBlock && currentlyBlocked) {
          // Odblokuj jeśli wszystkie raporty zostały złożone (nie powinno tu wejść, ale na wszelki wypadek)
          await base44.asServiceRole.entities.AllowedUser.update(ua.id, {
            is_blocked: false,
            blocked_reason: '',
            missing_reports_count: missing.length,
          });
          usersUnblocked++;
        } else {
          // Aktualizuj tylko licznik
          await base44.asServiceRole.entities.AllowedUser.update(ua.id, {
            missing_reports_count: missing.length,
          });
        }
      }

      // Wyślij powiadomienie dla każdego brakującego raportu (raz dziennie)
      for (const { assignment, diffDays } of missing) {
        const alreadySentToday = notifications.some(n =>
          n.user_email === email &&
          n.type === 'system_error' &&
          n.message?.includes(assignment.client_name) &&
          n.message?.includes(assignment.meeting_date) &&
          n.created_date?.startsWith(todayStr)
        );

        if (alreadySentToday) continue;

        const blockedInfo = shouldBlock ? ' 🔒 KONTO ZABLOKOWANE.' : ` Blokada nastąpi po ${BLOCK_AFTER_DAYS} dniach.`;

        await base44.asServiceRole.entities.Notification.create({
          user_email: email,
          type: 'system_error',
          title: shouldBlock ? '🔒 Konto zablokowane – brak raportu' : '⚠️ Brak raportu po spotkaniu',
          message: `Brak raportu po spotkaniu z klientem ${assignment.client_name} (${assignment.meeting_date}). Opóźnienie: ${diffDays} ${diffDays === 1 ? 'dzień' : 'dni'}.${blockedInfo}`,
          is_read: false,
        });

        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: email,
            subject: `${shouldBlock ? '🔒 Konto zablokowane' : '⚠️ Brak raportu'} – ${assignment.client_name} (${diffDays} dni opóźnienia)`,
            body: emailTemplate(assignment.client_name, assignment.meeting_date, diffDays),
          });
        } catch (_) {}

        notifsSent++;
      }
    }

    // Odblokuj użytkowników którzy już złożyli wszystkie raporty
    for (const ua of allowedUsers) {
      const email = ua.data?.email || ua.email;
      const currentlyBlocked = ua.data?.is_blocked || ua.is_blocked || false;
      if (!currentlyBlocked) continue;
      if (missingByUser[email]) continue; // nadal ma braki

      await base44.asServiceRole.entities.AllowedUser.update(ua.id, {
        is_blocked: false,
        blocked_reason: '',
        missing_reports_count: 0,
      });
      usersUnblocked++;
    }

    return Response.json({ ok: true, checked: assignments.length, notifsSent, usersBlocked, usersUnblocked });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});