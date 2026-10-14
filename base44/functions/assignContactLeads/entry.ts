import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

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

    const canAssign = ['admin', 'group_leader', 'team_leader', 'structure_director'].includes(currentRole);
    if (!canAssign) {
      return Response.json({ error: 'Brak uprawnień do przypisywania kontaktów' }, { status: 403 });
    }

    const pkg = packages[0];
    if (!pkg) {
      return Response.json({ error: 'Nie znaleziono paczki' }, { status: 404 });
    }

    const packageGroupId = pkg.group_id || pkg.data?.group_id || '';
    if (currentRole === 'structure_director') {
      // Dyrektor: tylko paczki, które utworzył lub które są do niego przypisane,
      // i tylko handlowcy z grup, którymi zarządza.
      const managedIds = currentAccess?.managed_group_ids || currentAccess?.data?.managed_group_ids || [];
      const pkgAssignedEmails = pkg.assigned_user_emails?.length
        ? pkg.assigned_user_emails
        : (pkg.assigned_user_email ? [pkg.assigned_user_email] : []);
      const ownsPackage = pkg.created_by_email === user.email || pkgAssignedEmails.includes(user.email)
        || (!!packageGroupId && managedIds.includes(packageGroupId));
      if (!ownsPackage) {
        return Response.json({ error: 'Brak dostępu do tej paczki kontaktów' }, { status: 403 });
      }

      if (userEmail !== user.email) {
        const [targets, groups] = await Promise.all([
          svc.AllowedUser.filter({ email: userEmail }),
          svc.Group.list(),
        ]);
        const target = targets[0];
        const targetGroupId = target?.group_id || target?.data?.group_id || '';
        const leaderKeys = new Set();
        groups.filter((g) => managedIds.includes(g.id)).forEach((g) => {
          const ids = g.group_leader_ids || g.data?.group_leader_ids || [];
          const legacyId = g.group_leader_id || g.data?.group_leader_id;
          [legacyId, ...ids].filter(Boolean).forEach((id) => leaderKeys.add(id));
        });
        const targetInManagedGroup = !!target && (
          (targetGroupId && managedIds.includes(targetGroupId)) ||
          leaderKeys.has(target.id) || leaderKeys.has(userEmail)
        );
        if (!targetInManagedGroup) {
          return Response.json({ error: 'Ten handlowiec nie należy do Twoich grup' }, { status: 403 });
        }
      }

      const packageLeads = await svc.ContactLead.filter({ package_id: packageId });
      const packageLeadIds = new Set(packageLeads.map((l) => l.id));
      if (!leadIds.every((id) => packageLeadIds.has(id))) {
        return Response.json({ error: 'Kontakty nie należą do tej paczki' }, { status: 403 });
      }
    } else if (currentRole !== 'admin') {
      const groups = await svc.Group.list();
      const managedGroupIds = groups
        .filter((group) => {
          const leaderIds = group.group_leader_ids || group.data?.group_leader_ids || [];
          const leaderId = group.group_leader_id || group.data?.group_leader_id || '';
          return leaderId === currentAccess?.id || leaderIds.includes(currentAccess?.id);
        })
        .map((group) => group.id);

      const pkgAssignedEmails = pkg.assigned_user_emails?.length
        ? pkg.assigned_user_emails
        : (pkg.assigned_user_email ? [pkg.assigned_user_email] : []);
      const hasAccessToPackageGroup = (!packageGroupId && !pkg.is_private) || packageGroupId === currentGroupId
        || managedGroupIds.includes(packageGroupId) || pkgAssignedEmails.includes(user.email);
      if (!hasAccessToPackageGroup) {
        return Response.json({ error: 'Brak dostępu do tej paczki kontaktów' }, { status: 403 });
      }

      // Cel przypisania: ten sam zespół lub dyrektor zarządzający grupą lidera
      const [targets] = await Promise.all([svc.AllowedUser.filter({ email: userEmail })]);
      const target = targets[0];
      const targetRole = target?.role || target?.data?.role;
      if (target && targetRole === 'structure_director') {
        const tManaged = target.managed_group_ids || target.data?.managed_group_ids || [];
        const myGroups = new Set([currentGroupId, ...managedGroupIds].filter(Boolean));
        if (!tManaged.some((gid) => myGroups.has(gid))) {
          return Response.json({ error: 'Ten dyrektor nie zarządza Twoją grupą' }, { status: 403 });
        }
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