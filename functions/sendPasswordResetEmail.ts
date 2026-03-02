import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin through AllowedUser
    const allowedUsers = await base44.asServiceRole.entities.AllowedUser.list();
    const allowedUser = allowedUsers.find(u => (u.data?.email || u.email) === user.email);
    
    if (!allowedUser || (allowedUser.data?.role || allowedUser.role) !== 'admin') {
      return Response.json({ error: 'Tylko adminowie mogą resetować hasła' }, { status: 403 });
    }

    const { targetEmail, targetName } = await req.json();

    if (!targetEmail) {
      return Response.json({ error: 'Email użytkownika jest wymagany' }, { status: 400 });
    }

    // Wyślij email ze wskazówkami resetowania
    await base44.integrations.Core.SendEmail({
      to: targetEmail,
      subject: 'Resetowanie hasła do aplikacji 4-ECO Green Energy',
      body: `Cześć ${targetName || 'Użytkowniku'},

Administrator zażądał resetowania Twojego hasła do aplikacji 4-ECO Green Energy.

Aby zresetować hasło, wejdź na stronę logowania i wybierz "Zapomniałem hasła".

Link do aplikacji: ${Deno.env.get('APP_URL') || 'https://app.example.com'}

Jeśli nie prosiłeś o resetowanie hasła, skontaktuj się z administratorem.

Pozdrawiamy,
Team 4-ECO Green Energy`
    });

    return Response.json({
      success: true,
      message: `Link resetowania hasła został wysłany na adres ${targetEmail}`
    });
  } catch (error) {
    console.error('Password reset error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});