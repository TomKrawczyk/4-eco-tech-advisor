import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { resolveAccessContext } from '../../shared/accessControl.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const ctx = await resolveAccessContext(base44);

    if (!ctx.authenticated) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!ctx.allowed) {
      // Nie ma wpisu w AllowedUser — tylko własne (zgodnie z dotychczasowym zachowaniem)
      return Response.json({ userEmails: [ctx.email] });
    }

    return Response.json({
      userEmails: ctx.visibleEmails,
      role: ctx.role,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});