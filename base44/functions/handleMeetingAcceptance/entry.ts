import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { assignmentId, status, reason } = await req.json();

    if (!assignmentId || !status) {
      return Response.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const assignment = await base44.asServiceRole.entities.MeetingAssignment.get(assignmentId);
    if (!assignment) {
      return Response.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // Sprawdź czy to przypisanie dotyczy obecnego usera
    if (assignment.assigned_user_email !== user.email) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Policz poprzednie odrzucenia dla tego spotkania
    const previousRejections = await base44.asServiceRole.entities.MeetingAcceptance.filter({
      meeting_assignment_id: assignmentId,
      status: 'rejected'
    });
    const rejectionCount = previousRejections.length + (status === 'rejected' ? 1 : 0);

    // Stwórz rekord akceptacji/odrzucenia
    await base44.asServiceRole.entities.MeetingAcceptance.create({
      meeting_assignment_id: assignmentId,
      assigned_user_email: user.email,
      assigned_user_name: user.displayName || user.full_name,
      status: status,
      rejection_reason: status === 'rejected' ? reason : null,
      rejection_timestamp: status === 'rejected' ? new Date().toISOString() : null,
      rejection_count: rejectionCount,
      in_rejected_pool: rejectionCount >= 2,
    });

    // Jeśli odrzucono, usuń przypisanie do handlowca
    if (status === 'rejected') {
      await base44.asServiceRole.entities.MeetingAssignment.update(assignmentId, {
        assigned_user_email: null,
        assigned_user_name: null,
      });

      // Jeśli to pierwsze odrzucenie, powiadom lidera grupy
      if (rejectionCount === 1 && assignment.assigned_group_id) {
         const group = await base44.asServiceRole.entities.Group.get(assignment.assigned_group_id);
         if (group && group.group_leader_ids && group.group_leader_ids.length > 0) {
            const leaders = await base44.asServiceRole.entities.AllowedUser.filter({
                id: { $in: group.group_leader_ids }
            });
            for (const leader of leaders) {
                await base44.asServiceRole.integrations.Core.SendEmail({
                    to: leader.email,
                    subject: `Spotkanie odrzucone: ${assignment.client_name}`,
                    body: `Handlowiec ${user.displayName} odrzucił spotkanie z ${assignment.client_name} (${assignment.meeting_calendar}). Powód: ${reason}. Spotkanie wróciło do puli grupy.`
                });
            }
         }
      }
      // Jeśli drugie lub kolejne, powiadom admina
      else if (rejectionCount >= 2) {
         await base44.asServiceRole.integrations.Core.SendEmail({
            to: 'admin@4-eco.pl',
            subject: `🚨 Spotkanie w puli odrzuconych: ${assignment.client_name}`,
            body: `Spotkanie z ${assignment.client_name} (${assignment.meeting_calendar}) zostało odrzucone ${rejectionCount} razy i trafiło do puli "Odrzucone spotkania".`
         });
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});