import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { email, full_name, company, phone, message } = await req.json();

    if (!email || !full_name) {
      return Response.json({ error: 'Email i imię są wymagane' }, { status: 400 });
    }

    // Sprawdź czy użytkownik już ma dostęp
    const allowedUsers = await base44.asServiceRole.entities.AllowedUser.list();
    const hasAccess = allowedUsers.find(u => (u.data?.email || u.email) === email);
    
    if (hasAccess) {
      return Response.json({ error: 'Ten użytkownik już ma dostęp do aplikacji' }, { status: 400 });
    }

    // Sprawdź czy już nie ma pendingowej prośby
    const existingRequests = await base44.asServiceRole.entities.RegistrationRequest.filter({ 
      email, 
      status: 'pending' 
    });
    
    if (existingRequests.length > 0) {
      return Response.json({ error: 'Prośba o dostęp już została wysłana i oczekuje na rozpatrzenie' }, { status: 400 });
    }

    // Utwórz prośbę o rejestrację
    const request = await base44.asServiceRole.entities.RegistrationRequest.create({
      email,
      full_name,
      company,
      phone,
      message,
      status: 'pending'
    });

    // Pobierz wszystkich adminów
    const admins = allowedUsers.filter(u => (u.data?.role || u.role) === 'admin');

    // Wyślij powiadomienia do wszystkich adminów
    for (const admin of admins) {
      await base44.asServiceRole.entities.Notification.create({
        user_email: admin.data?.email || admin.email,
        type: 'user_activity',
        title: 'Nowa prośba o dostęp',
        message: `${full_name} (${email}) prosi o dostęp do aplikacji`,
        link: '/UserManagement',
        metadata: {
          request_id: request.id,
          email: email,
          full_name: full_name
        }
      });
    }

    return Response.json({ 
      success: true, 
      message: 'Prośba o dostęp została wysłana do administratorów' 
    });
  } catch (error) {
    console.error('Error in requestAccess:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});