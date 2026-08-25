import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      action_type, page_name, details, report_id, metadata,
      impersonated_email, impersonated_name, impersonated_by,
    } = await req.json();

    if (!action_type) {
      return Response.json({ error: 'action_type is required' }, { status: 400 });
    }

    let logEmail = user.email;
    let logName = user.full_name;
    const meta = { ...(metadata || {}) };

    // Impersonacja: gdy admin działa w trybie podglądu, log przypisujemy do
    // podglądanego użytkownika z metadanymi kto podgląda.
    if (impersonated_email) {
      const adminRecords = await base44.asServiceRole.entities.AllowedUser.filter({ email: user.email });
      const adminRole = adminRecords[0]?.data?.role || adminRecords[0]?.role;
      if (adminRole === 'admin') {
        logEmail = impersonated_email;
        logName = impersonated_name || impersonated_email;
        meta.impersonated_by = impersonated_by || user.email;
      }
    }

    await base44.entities.ActivityLog.create({
      user_email: logEmail,
      user_name: logName,
      action_type,
      page_name: page_name || null,
      details: details || {},
      report_id: report_id || null,
      metadata: meta,
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});