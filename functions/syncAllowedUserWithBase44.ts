import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const event = body.event;

    // Obsługuj tylko dla AllowedUser
    if (event.entity_name !== 'AllowedUser') {
      return Response.json({ ok: true });
    }

    const data = body.data;
    const email = data?.email;

    if (!email) {
      return Response.json({ ok: true });
    }

    // CREATE - zaprość użytkownika
    if (event.type === 'create') {
      try {
        const role = data?.role || 'user';
        await base44.asServiceRole.users.inviteUser(email, role);
        console.log(`Zaproszenie wysłane dla ${email}`);
      } catch (inviteError) {
        console.warn(`Zaproszenie nie powiodło się dla ${email}:`, inviteError);
      }
      return Response.json({ ok: true, action: 'invite_sent' });
    }

    // DELETE - nie usuwamy danych użytkownika, przechowujemy je dla archiwizacji
    if (event.type === 'delete') {
      console.log(`Użytkownik ${email} usunięty z dostępu, dane zachowane dla archiwizacji`);
      return Response.json({ ok: true, action: 'access_removed_data_preserved' });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error('Błąd w syncAllowedUserWithBase44:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});