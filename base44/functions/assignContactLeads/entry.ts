import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
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

    const svc = base44.asServiceRole.entities;

    const [allowedMatches, packages] = await Promise.all([
      svc.AllowedUser.filter({ email: user.email }),
      svc.ContactPackage.filter({ id: packageId }),
    ]);

    const currentAccess = allowedMatches[0];
    const currentRole = currentAccess?.role || currentAccess?.data?.role || user.role;
    const currentGroupId = currentAccess?.group_id || currentAccess?.data?.group_id || '';

    const canAssign = ['admin', 'group_leader', 'team_leader'].includes(currentRole);
    if (!canAssign) {
      return Response.json({ error: 'Brak uprawnień do przypisywania kontaktów' }, { status: 403 });
    }

    const pkg = packages[0];
    if (!pkg) {
      return Response.json({ error: 'Nie znaleziono paczki' }, { status: 404 });
    }

    const packageGroupId = pkg.group_id || pkg.data?.group_id || '';
    if (currentRole !== 'admin') {
      const groups = await svc.Group.list();
      const managedGroupIds = groups
        .filter((group) => {
          const leaderIds = group.group_leader_ids || group.data?.group_leader_ids || [];
          const leaderId = group.group_leader_id || group.data?.group_leader_id || '';
          return leaderId === currentAccess?.id || leaderIds.includes(currentAccess?.id);
        })
        .map((group) => group.id);

      const hasAccessToPackageGroup = !packageGroupId || packageGroupId === currentGroupId || managedGroupIds.includes(packageGroupId);
      if (!hasAccessToPackageGroup) {
        return Response.json({ error: 'Brak dostępu do tej paczki kontaktów' }, { status: 403 });
      }
    }

    const nowIso = new Date().toISOString();
    const updates = leadIds.map((id) => ({
      id,
      assigned_user_email: userEmail,
      assigned_user_name: userName || userEmail,
      assigned_at: nowIso,
      status: 'assigned',
    }));

    for (let i = 0; i < updates.length; i += 500) {
      await svc.ContactLead.bulkUpdate(updates.slice(i, i + 500));
    }

    const fresh = await svc.ContactLead.filter({ package_id: packageId });
    await svc.ContactPackage.update(packageId, {
      total_count: fresh.length,
      assigned_count: fresh.filter((lead) => lead.assigned_user_email).length,
    });

    return Response.json({ success: true, updated: leadIds.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}