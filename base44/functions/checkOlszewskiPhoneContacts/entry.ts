import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin' && user?.role !== 'hr_admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const groupName = 'PH Grupa Północ - Olszewski';
    const groups = await base44.asServiceRole.entities.Group.list();
    const group = groups.find((g) => g.name === groupName);

    if (!group) {
      return Response.json({ groupName, error: 'Group not found', contacts: [] });
    }

    const contacts = await base44.asServiceRole.entities.PhoneContact.filter({ assigned_group_id: group.id });
    const targetContacts = contacts.filter((contact) => {
      const name = (contact.client_name || '').toLowerCase();
      return name.includes('bogumiła') || name.includes('bogumila') || name.includes('ryngwelska') || name.includes('władyslaw') || name.includes('władysław') || name.includes('wladyslaw') || name.includes('świerszcz') || name.includes('swierszcz');
    });

    return Response.json({
      group: { id: group.id, name: group.name },
      totalContactsInGroup: contacts.length,
      targetContacts: targetContacts.map((contact) => ({
        id: contact.id,
        client_name: contact.client_name,
        phone: contact.phone,
        address: contact.address,
        contact_date: contact.contact_date,
        date: contact.date,
        status: contact.status,
        assigned_user_name: contact.assigned_user_name,
        assigned_user_email: contact.assigned_user_email,
        assigned_group_name: contact.assigned_group_name,
        sheet: contact.sheet,
        comments: contact.comments,
        created_date: contact.created_date,
        updated_date: contact.updated_date,
      })),
      contactsWithoutReport: contacts
        .filter((contact) => !contact.assigned_user_email)
        .map((contact) => ({
          client_name: contact.client_name,
          phone: contact.phone,
          status: contact.status,
          contact_date: contact.contact_date,
          sheet: contact.sheet,
        })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});