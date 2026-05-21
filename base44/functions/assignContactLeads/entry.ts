import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { leadIds, userEmail, userName, packageId } = await req.json();

    if (!Array.isArray(leadIds) || leadIds.length === 0 || !userEmail || !packageId) {
      return Response.json({ error: 'Brak wymaganych danych' }, { status: 400 });
    }

    const allowedUsers = await base44.asServiceRole.entities.AllowedUser.list();
    const currentAccess = allowedUsers.find((u) => (u.email || u.data?.email) === user.email);
    const currentRole = currentAccess?.role || currentAccess?.data?.role || user.role;
    const currentGroupId = currentAccess?.group_id || currentAccess?.data?.group_id || '';

    const canAssign = ['admin', 'group_leader', 'team_leader'].includes(currentRole);
    if (!canAssign) {
      return Response.json({ error: 'Brak uprawnień do przypisywania kontaktów' }, { status: 403 });
    }

    const packages = await base44.asServiceRole.entities.ContactPackage.filter({ id: packageId });
    const pkg = packages[0];
    if (!pkg) {
      return Response.json({ error: 'Nie znaleziono paczki' }, { status: 404 });
    }

    const packageGroupId = pkg.group_id || pkg.data?.group_id || '';
    if (currentRole !== 'admin' && packageGroupId && currentGroupId && packageGroupId !== currentGroupId) {
      return Response.json({ error: 'Brak dostępu do tej paczki kontaktów' }, { status: 403 });
    }

    for (const id of leadIds) {
      await base44.asServiceRole.entities.ContactLead.update(id, {
        assigned_user_email: userEmail,
        assigned_user_name: userName || userEmail,
        status: 'assigned',
      });
    }

    const fresh = await base44.asServiceRole.entities.ContactLead.filter({ package_id: packageId });
    await base44.asServiceRole.entities.ContactPackage.update(packageId, {
      total_count: fresh.length,
      assigned_count: fresh.filter((lead) => lead.assigned_user_email).length,
    });

    return Response.json({ success: true, updated: leadIds.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});