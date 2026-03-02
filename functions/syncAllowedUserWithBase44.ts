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

    // DELETE - usuń powiązane kontakty
    if (event.type === 'delete') {
      try {
        const contacts = await base44.asServiceRole.entities.PhoneContact.filter({ 
          assigned_user_email: email 
        });
        for (const contact of contacts) {
          await base44.asServiceRole.entities.PhoneContact.delete(contact.id);
        }
        console.log(`Usunięto ${contacts.length} kontaktów dla ${email}`);
      } catch (contactError) {
        console.warn(`Błąd przy usuwaniu kontaktów dla ${email}:`, contactError);
      }
      return Response.json({ ok: true, action: 'contacts_deleted' });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error('Błąd w syncAllowedUserWithBase44:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});