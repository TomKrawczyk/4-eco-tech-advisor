import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function findManagedUser(allowedUsers, identifier) {
  return allowedUsers.find((u) => u.id === identifier || (u.data?.email || u.email) === identifier);
}

function resolveGroupId(currentUserData, groups) {
  const directGroupId = currentUserData.data?.group_id || currentUserData.group_id;
  if (directGroupId) return directGroupId;

  const currentUserId = currentUserData.id;
  const currentUserEmail = currentUserData.data?.email || currentUserData.email;
  const group = groups.find((g) => {
    const leaderIds = g.data?.group_leader_ids || g.group_leader_ids || [];
    const legacyLeaderId = g.data?.group_leader_id || g.group_leader_id;
    return leaderIds.includes(currentUserId) || leaderIds.includes(currentUserEmail) || legacyLeaderId === currentUserId || legacyLeaderId === currentUserEmail;
  });

  return group?.id || null;
}

async function listAll(entity, sort = '-created_date', pageSize = 200) {
  const results = [];
  let skip = 0;

  while (true) {
    const batch = await entity.list(sort, pageSize, skip);
    if (!batch?.length) break;
    results.push(...batch);
    if (batch.length < pageSize) break;
    skip += pageSize;
  }

  return results;
}

Deno.serve(async (req) => {
  try {
    const payload = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [allowedUsers, groups, reports] = await Promise.all([
      listAll(base44.asServiceRole.entities.AllowedUser),
      listAll(base44.asServiceRole.entities.Group),
      listAll(base44.asServiceRole.entities.MeetingReport),
    ]);

    const currentUserData = allowedUsers.find((u) => (u.data?.email || u.email) === user.email);

    if (!currentUserData) {
      return Response.json({ reports: [] });
    }

    const role = currentUserData.data?.role || currentUserData.role || 'user';

    if (role === 'admin') {
      if (payload.count_only) {
        return Response.json({ total: reports.length, role });
      }
      return Response.json({ reports, total: reports.length, role });
    }

    let userEmails = [user.email];

    if (role === 'group_leader') {
      const groupId = resolveGroupId(currentUserData, groups);

      if (groupId) {
        allowedUsers.forEach((u) => {
          const uGroupId = u.data?.group_id || u.group_id;
          if (uGroupId === groupId) {
            userEmails.push(u.data?.email || u.email);
          }
        });
      }

      const managedUsers = currentUserData.data?.managed_users || currentUserData.managed_users || [];
      managedUsers.forEach((identifier) => {
        const managedUser = findManagedUser(allowedUsers, identifier);
        if (managedUser) {
          userEmails.push(managedUser.data?.email || managedUser.email);
          const managedRole = managedUser.data?.role || managedUser.role;
          if (managedRole === 'team_leader') {
            const teamUsers = managedUser.data?.managed_users || managedUser.managed_users || [];
            teamUsers.forEach((teamIdentifier) => {
              const teamUser = findManagedUser(allowedUsers, teamIdentifier);
              if (teamUser) userEmails.push(teamUser.data?.email || teamUser.email);
            });
          }
        }
      });
    } else if (role === 'team_leader') {
      const managedUsers = currentUserData.data?.managed_users || currentUserData.managed_users || [];
      managedUsers.forEach((identifier) => {
        const managedUser = findManagedUser(allowedUsers, identifier);
        if (managedUser) userEmails.push(managedUser.data?.email || managedUser.email);
      });
    }

    const allowedSet = new Set(userEmails);
    const visibleReports = reports.filter((report) => allowedSet.has(report.created_by) || allowedSet.has(report.author_email));

    if (payload.count_only) {
      return Response.json({ total: visibleReports.length, role });
    }

    return Response.json({ reports: visibleReports, total: visibleReports.length, role });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});