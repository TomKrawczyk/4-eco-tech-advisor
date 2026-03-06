import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const allowedUsers = await base44.entities.AllowedUser.list();
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
            // Group leader widzi siebie, swoich team leaderów i ich użytkowników
            userEmails = [user.email];
            
            const managedUsers = currentUserData.data?.managed_users || currentUserData.managed_users || [];
            managedUsers.forEach(managedId => {
                const managedUser = allowedUsers.find(u => u.id === managedId);
                if (managedUser) {
                    userEmails.push(managedUser.data?.email || managedUser.email);
                    
                    // Jeśli to team leader, dodaj jego użytkowników
                    const mRole = managedUser.data?.role || managedUser.role;
                    if (mRole === 'team_leader') {
                        const teamUsers = managedUser.data?.managed_users || managedUser.managed_users || [];
                        teamUsers.forEach(teamUserId => {
                            const teamUser = allowedUsers.find(u => u.id === teamUserId);
                            if (teamUser) userEmails.push(teamUser.data?.email || teamUser.email);
                        });
                    }
                }
            });
        } else if (role === 'team_leader') {
            // Team leader widzi siebie i swoich użytkowników
            userEmails = [user.email];
            
            const managedUsers = currentUserData.data?.managed_users || currentUserData.managed_users || [];
            managedUsers.forEach(managedId => {
                const managedUser = allowedUsers.find(u => u.id === managedId);
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