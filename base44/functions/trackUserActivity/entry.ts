import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body = {};
    try { body = await req.json(); } catch (_) {}

    const impersonated_email = (body && body.impersonated_email) || null;
    let targetEmail = user.email;

    // W trybie podglądu aktualizujemy last_activity na koncie podglądanego użytkownika.
    if (impersonated_email) {
      const adminRecords = await base44.asServiceRole.entities.AllowedUser.filter({ email: user.email });
      const adminRole = adminRecords[0]?.data?.role || adminRecords[0]?.role;
      if (adminRole !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      targetEmail = impersonated_email;
    }

    const results = await base44.asServiceRole.entities.AllowedUser.filter({ email: targetEmail });
    const allowedUser = results[0];

    if (allowedUser) {
      await base44.asServiceRole.entities.AllowedUser.update(allowedUser.id, {
        last_activity: new Date().toISOString()
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error tracking activity:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});