import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const mainAdminEmail = (secrets.get("MAIN_ADMIN_EMAIL") || "").trim().toLowerCase();
    const isMainAdmin = !!mainAdminEmail && (user.email || "").trim().toLowerCase() === mainAdminEmail;

    return Response.json({ is_main_admin: isMainAdmin });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}