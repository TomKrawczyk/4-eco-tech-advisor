import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data, old_data } = await req.json();

    if (!event || !data) {
      return Response.json({ error: 'Missing event or data' }, { status: 400 });
    }

    // Pobierz dane użytkownika z created_by
    const userEmail = data.created_by;
    if (!userEmail) {
      return Response.json({ success: true, message: 'No user email' });
    }

    const allowedUsers = await base44.asServiceRole.entities.AllowedUser.list();
    const userAccess = allowedUsers.find(allowed => 
      (allowed.data?.email || allowed.email) === userEmail
    );

    const userName = userAccess?.data?.name || userAccess?.name || userEmail;

    let actionType = '';
    let details = {
      client_name: data.client_name,
      report_status: data.status
    };

    if (event.type === 'create') {
      actionType = 'report_create';
      details.created_at = new Date().toISOString();
    } else if (event.type === 'update') {
      actionType = 'report_update';
      // Sprawdź co się zmieniło
      const changes = [];
      if (old_data) {
        if (old_data.status !== data.status) changes.push(`status: ${old_data.status} -> ${data.status}`);
        if (old_data.client_name !== data.client_name) changes.push(`klient: ${old_data.client_name} -> ${data.client_name}`);
      }
      details.changes = changes.join(', ') || 'edycja danych';
    } else if (event.type === 'delete') {
      actionType = 'report_delete';
    }

    // Utwórz log aktywności
    await base44.asServiceRole.entities.ActivityLog.create({
      user_email: userEmail,
      user_name: userName,
      action_type: actionType,
      page_name: 'VisitReports',
      report_id: event.entity_id,
      details: details,
      metadata: {
        auto_logged: true,
        event_type: event.type
      }
    });

    return Response.json({ success: true, logged: actionType });
  } catch (error) {
    console.error('Error in autoLogReportActivity:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});