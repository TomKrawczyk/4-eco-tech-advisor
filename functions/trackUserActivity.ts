import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Filtruj bezpośrednio po emailu zamiast pobierać wszystkich
    const results = await base44.asServiceRole.entities.AllowedUser.filter({ email: user.email });
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