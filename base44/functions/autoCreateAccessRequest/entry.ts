import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    // Tylko dla nowych użytkowników
    if (event.type !== 'create') {
      return Response.json({ success: true, message: 'Not a create event' });
    }

    const userEmail = data?.email || data.email;
    const fullName = data?.full_name || data.full_name;

    // Sprawdź czy użytkownik już ma dostęp
    const allowedUsers = await base44.asServiceRole.entities.AllowedUser.list();
    const hasAccess = allowedUsers.find(u => (u.data?.email || u.email) === userEmail);
    
    if (hasAccess) {
      return Response.json({ success: true, message: 'User already has access' });
    }

    // Sprawdź czy już nie ma prośby
    const existingRequests = await base44.asServiceRole.entities.RegistrationRequest.filter({ 
      email: userEmail, 
      status: 'pending' 
    });
    
    if (existingRequests.length > 0) {
      return Response.json({ success: true, message: 'Request already exists' });
    }

    // Utwórz prośbę o dostęp
    const request = await base44.asServiceRole.entities.RegistrationRequest.create({
      email: userEmail,
      full_name: fullName,
      status: 'pending',
      message: 'Automatyczna rejestracja przez system Base44'
    });

    // Pobierz wszystkich adminów i wyślij powiadomienia
    const admins = allowedUsers.filter(u => (u.data?.role || u.role) === 'admin');

    for (const admin of admins) {
      try {
        await base44.asServiceRole.entities.Notification.create({
          user_email: admin.data?.email || admin.email,
          type: 'user_activity',
          title: 'Nowy użytkownik oczekuje na dostęp',
          message: `${fullName} (${userEmail}) zarejestrował się i oczekuje na akceptację`,
          link: '/UserManagement',
          metadata: {
            request_id: request.id,
            email: userEmail,
            full_name: fullName
          }
        });
      } catch (notifError) {
        console.warn('Nie udało się wysłać powiadomienia do admina:', notifError);
      }
    }

    return Response.json({ 
      success: true, 
      message: 'Access request created automatically' 
    });
  } catch (error) {
    console.error('Error in autoCreateAccessRequest:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});