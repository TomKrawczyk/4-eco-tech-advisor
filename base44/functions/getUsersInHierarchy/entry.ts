import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function findManagedUser(allowedUsers, identifier) {
    return allowedUsers.find(u => u.id === identifier || (u.data?.email || u.email) === identifier);
}

function resolveGroupId(currentUserData, groups) {
    const directGroupId = currentUserData.data?.group_id || currentUserData.group_id;
    if (directGroupId) return directGroupId;

    const currentUserId = currentUserData.id;
    const currentUserEmail = currentUserData.data?.email || currentUserData.email;
    const group = groups.find(g => {
        const leaderIds = g.data?.group_leader_ids || g.group_leader_ids || [];
        const legacyLeaderId = g.data?.group_leader_id || g.group_leader_id;
        return leaderIds.includes(currentUserId) || leaderIds.includes(currentUserEmail) || legacyLeaderId === currentUserId || legacyLeaderId === currentUserEmail;
    });

    return group?.id || null;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const [allowedUsers, groups] = await Promise.all([
            base44.entities.AllowedUser.list(),
            base44.entities.Group.list(),
        ]);
        const currentUserData = allowedUsers.find(u => (u.data?.email || u.email) === user.email);
        
        if (!currentUserData) {
            return Response.json({ userEmails: [user.email] });
        }

        const role = currentUserData.data?.role || currentUserData.role || 'user';
        let userEmails = [];

        if (role === 'admin') {
            // Admin widzi wszystkich
            userEmails = allowedUsers.map(u => u.data?.email || u.email);
        } else if (role === 'group_leader') {
            userEmails = [user.email];

            const groupId = resolveGroupId(currentUserData, groups);

            if (groupId) {
                allowedUsers.forEach(u => {
                    const uGroupId = u.data?.group_id || u.group_id;
                    if (uGroupId === groupId) {
                        userEmails.push(u.data?.email || u.email);
                    }
                });
            }

            const managedUsers = currentUserData.data?.managed_users || currentUserData.managed_users || [];
            managedUsers.forEach(identifier => {
                const managedUser = findManagedUser(allowedUsers, identifier);
                if (managedUser) {
                    userEmails.push(managedUser.data?.email || managedUser.email);
                    const mRole = managedUser.data?.role || managedUser.role;
                    if (mRole === 'team_leader') {
                        const teamUsers = managedUser.data?.managed_users || managedUser.managed_users || [];
                        teamUsers.forEach(teamIdentifier => {
                            const teamUser = findManagedUser(allowedUsers, teamIdentifier);
                            if (teamUser) userEmails.push(teamUser.data?.email || teamUser.email);
                        });
                    }
                }
            });
        } else if (role === 'team_leader') {
            userEmails = [user.email];
            
            const managedUsers = currentUserData.data?.managed_users || currentUserData.managed_users || [];
            managedUsers.forEach(identifier => {
                const managedUser = findManagedUser(allowedUsers, identifier);
                if (managedUser) userEmails.push(managedUser.data?.email || managedUser.email);
            });
        } else {
            // Zwykły użytkownik widzi tylko siebie
            userEmails = [user.email];
        }

        return Response.json({ 
            userEmails: [...new Set(userEmails)],
            role 
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});