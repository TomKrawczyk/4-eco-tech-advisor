import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { meeting_assignment_id, status, rejection_reason } = await req.json();

    if (!meeting_assignment_id || !status || !['accepted', 'rejected'].includes(status)) {
      return Response.json({ error: 'Invalid input' }, { status: 400 });
    }

    if (status === 'rejected' && !rejection_reason?.trim()) {
      return Response.json({ error: 'Rejection reason required' }, { status: 400 });
    }

    // Pobierz przypisanie spotkania
    const assignment = await base44.entities.MeetingAssignment.get(meeting_assignment_id);
    if (!assignment) {
      return Response.json({ error: 'Meeting assignment not found' }, { status: 404 });
    }

    // Stwórz rekord akceptacji/odrzucenia
    const acceptance = {
      meeting_assignment_id,
      assigned_user_email: user.email,
      assigned_user_name: user.full_name,
      status
    };

    if (status === 'rejected') {
      acceptance.rejection_reason = rejection_reason;
      acceptance.rejection_timestamp = new Date().toISOString();

      // Pobierz poprzednie odrzucenia
      const previousRejections = await base44.entities.MeetingAcceptance.filter({
        meeting_assignment_id,
        status: 'rejected'
      });

      const rejectionCount = previousRejections.length + 1;
      acceptance.rejection_count = rejectionCount;

      // Jeśli 2+ odrzucenia → do puli dla admina
      if (rejectionCount >= 2) {
        acceptance.in_rejected_pool = true;
        // Odjąć z przypisania
        await base44.entities.MeetingAssignment.update(meeting_assignment_id, {
          assigned_user_email: null,
          assigned_user_name: null,
          assigned_group_id: null,
          assigned_group_name: null
        });
      } else {
        // Pierwsze odrzucenie - wróć do menadżera/lidera
        const allowedUsers = await base44.entities.AllowedUser.filter({
          email: user.email
        });
        const currentUser = allowedUsers[0];

        if (currentUser?.assigned_to) {
          acceptance.returned_to_email = currentUser.assigned_to;
          // Przywróć do menadżera/lidera
          const manager = await base44.entities.AllowedUser.get(currentUser.assigned_to);
          await base44.entities.MeetingAssignment.update(meeting_assignment_id, {
            assigned_user_email: manager?.email,
            assigned_user_name: manager?.name
          });
        }
      }

      // Zlicz odrzucenia użytkownika w tym miesiącu
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      const monthlyRejections = await base44.entities.MeetingAcceptance.filter({
        assigned_user_email: user.email,
        status: 'rejected'
      });

      const thisMonthCount = monthlyRejections.filter(r => {
        const rejDate = r.rejection_timestamp?.split('T')[0];
        return rejDate >= monthStart && rejDate <= monthEnd;
      }).length + 1; // +1 dla bieżącego

      // Jeśli 6+ odrzuceń → blokuj dostęp
      if (thisMonthCount >= 6) {
        const userRecord = await base44.entities.AllowedUser.filter({
          email: user.email
        });
        if (userRecord[0]) {
          await base44.entities.AllowedUser.update(userRecord[0].id, {
            is_blocked: true,
            blocked_reason: `Zbyt wiele odrzuceń spotkań (${thisMonthCount}) w tym miesiącu`,
            missing_reports_count: thisMonthCount
          });
        }
      } else if (thisMonthCount >= 5) {
        // Wyślij ostrzeżenie
        await base44.integrations.Core.SendEmail({
          to: user.email,
          subject: '⚠️ Ostrzeżenie: Wysokie liczba odrzuceń spotkań',
          body: `Odrzuciłeś już ${thisMonthCount} spotkań(a) w tym miesiącu. Po 6 odrzuceniach zostanie zablokowany Twój dostęp do aplikacji. Bądź ostrożny!`
        });
      }
    } else {
      // Akceptacja - oznacz przypisanie jako zaakceptowane
      await base44.entities.MeetingAssignment.update(meeting_assignment_id, {
        notes: (assignment.notes || '') + `\n[ACCEPTED: ${new Date().toLocaleString('pl-PL')}]`
      });
    }

    await base44.entities.MeetingAcceptance.create(acceptance);

    return Response.json({
      success: true,
      status,
      rejection_count: acceptance.rejection_count,
      in_rejected_pool: acceptance.in_rejected_pool
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});