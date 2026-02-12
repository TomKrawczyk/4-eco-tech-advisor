import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action_type, page_name, details, report_id, metadata } = await req.json();

    if (!action_type) {
      return Response.json({ error: 'action_type is required' }, { status: 400 });
    }

    // Pobierz dane użytkownika z AllowedUser
    const allowedUsers = await base44.entities.AllowedUser.list();
    const userAccess = allowedUsers.find(allowed => 
      (allowed.data?.email || allowed.email) === user.email
    );

    await base44.entities.ActivityLog.create({
      user_email: user.email,
      user_name: userAccess?.data?.name || userAccess?.name || user.full_name,
      action_type,
      page_name: page_name || null,
      details: details || {},
      report_id: report_id || null,
      metadata: metadata || {}
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});