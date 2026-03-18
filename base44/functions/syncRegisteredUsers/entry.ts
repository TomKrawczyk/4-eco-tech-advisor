import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Wymaga uprawnień admina
    const user = await base44.auth.me();
    const allowedUsers = await base44.asServiceRole.entities.AllowedUser.list();
    const userAccess = allowedUsers.find(u => (u.data?.email || u.email) === user.email);
    
    if (userAccess?.role !== 'admin' && userAccess?.data?.role !== 'admin') {
      return Response.json({ error: 'Brak uprawnień' }, { status: 403 });
    }

    // Pobierz wszystkich użytkowników z systemu
    const allSystemUsers = await base44.asServiceRole.entities.User.list();

    const results = {
      checked: 0,
      created: 0,
      skipped: 0,
      errors: []
    };

    for (const systemUser of allSystemUsers) {
      results.checked++;
      
      const email = systemUser.data?.email || systemUser.email;
      const fullName = systemUser.data?.full_name || systemUser.full_name;

      // Sprawdź czy ma dostęp
      const hasAccess = allowedUsers.find(u => (u.data?.email || u.email) === email);
      if (hasAccess) {
        results.skipped++;
        continue;
      }

      // Sprawdź czy ma już prośbę
      const existingRequests = await base44.asServiceRole.entities.RegistrationRequest.filter({ 
        email: email, 
        status: 'pending' 
      });
      
      if (existingRequests.length > 0) {
        results.skipped++;
        continue;
      }

      try {
        // Utwórz prośbę
        const request = await base44.asServiceRole.entities.RegistrationRequest.create({
          email: email,
          full_name: fullName || email.split('@')[0],
          status: 'pending',
          message: 'Użytkownik zarejestrowany - wymaga akceptacji admina'
        });

        // Wyślij powiadomienia do adminów
        const admins = allowedUsers.filter(u => (u.data?.role || u.role) === 'admin');
        for (const admin of admins) {
          await base44.asServiceRole.entities.Notification.create({
            user_email: admin.data?.email || admin.email,
            type: 'user_activity',
            title: 'Nowy użytkownik oczekuje na dostęp',
            message: `${fullName || email} (${email}) wymaga akceptacji`,
            link: '/UserManagement',
            metadata: {
              request_id: request.id,
              email: email,
              full_name: fullName || email
            }
          });
        }

        results.created++;
      } catch (error) {
        results.errors.push({ email, error: error.message });
      }
    }

    return Response.json({ 
      success: true,
      results
    });
  } catch (error) {
    console.error('Error in syncRegisteredUsers:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});