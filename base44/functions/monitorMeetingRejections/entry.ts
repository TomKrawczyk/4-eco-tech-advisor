import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Pobierz wszystkich użytkowników
    const users = await base44.asServiceRole.entities.AllowedUser.list();

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    // Dla każdego użytkownika policz odrzucenia w tym miesiącu
    for (const user of users) {
      const userEmail = user.data?.email || user.email;
      if (!userEmail) continue;

      const rejections = await base44.asServiceRole.entities.MeetingAcceptance.filter({
        assigned_user_email: userEmail,
        status: 'rejected'
      });

      const thisMonthCount = rejections.filter(r => {
        const rejDate = r.rejection_timestamp?.split('T')[0];
        return rejDate >= monthStart && rejDate <= monthEnd;
      }).length;

      // Jeśli 6+ odrzuceń → blokuj
      if (thisMonthCount >= 6) {
        if (!user.is_blocked) {
          await base44.asServiceRole.entities.AllowedUser.update(user.id, {
            is_blocked: true,
            blocked_reason: `Zbyt wiele odrzuceń spotkań (${thisMonthCount}) w tym miesiącu`,
            missing_reports_count: thisMonthCount
          });

          // Wyślij email do administratora
          await base44.integrations.Core.SendEmail({
            to: 'admin@4-eco.pl',
            subject: `🚨 Użytkownik zablokowany: ${user.name} - ${thisMonthCount} odrzuceń`,
            body: `Użytkownik ${user.name} (${userEmail}) został automatycznie zablokowany z powodu ${thisMonthCount} odrzuceń spotkań w tym miesiącu.`
          });
        }
      }
      // Jeśli 5 odrzuceń → wyślij ostrzeżenie
      else if (thisMonthCount === 5) {
        await base44.integrations.Core.SendEmail({
          to: userEmail,
          subject: '⚠️ Ostatnie ostrzeżenie: Wysokie liczba odrzuceń spotkań',
          body: `Odrzuciłeś już 5 spotkań w tym miesiącu. Po 6 odrzuceniach zostanie zablokowany Twój dostęp do aplikacji. Bądź ostrożny!`
        });
      }
    }

    return Response.json({ success: true, processed: users.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});