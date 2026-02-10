import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Znajdź AllowedUser dla tego użytkownika
    const allowedUsers = await base44.asServiceRole.entities.AllowedUser.list();
    const allowedUser = allowedUsers.find(u => (u.data?.email || u.email) === user.email);

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