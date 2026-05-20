import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { packageMeta, contacts, packageId } = await req.json();

  let pkg = null;

  if (packageId) {
    const packages = await base44.asServiceRole.entities.ContactPackage.filter({ id: packageId });
    pkg = packages[0];
    if (!pkg) {
      return Response.json({ error: 'Nie znaleziono paczki do doimportowania kontaktów.' }, { status: 404 });
    }
  } else {
    if (!packageMeta.group_id) {
      return Response.json({ error: 'Brak przypisanej grupy. Skontaktuj się z administratorem.' }, { status: 400 });
    }

    // Utwórz paczkę
    pkg = await base44.asServiceRole.entities.ContactPackage.create({
      name: packageMeta.name,
      description: packageMeta.description || "",
      group_id: packageMeta.group_id,
      group_name: packageMeta.group_name || "",
      created_by_email: user.email,
      created_by_name: packageMeta.created_by_name || "",
      total_count: 0,
      assigned_count: 0,
      status: "active",
    });
  }

  // Bulk insert partiami po 100
  const BATCH = 100;
  let created = 0;
  for (let i = 0; i < contacts.length; i += BATCH) {
    const batch = contacts.slice(i, i + BATCH).map(c => ({
      package_id: pkg.id,
      group_id: pkg.group_id || packageMeta.group_id,
      client_name: c.client_name || "",
      client_phone: c.client_phone || "",
      client_address: c.client_address || "",
      postal_code: c.postal_code || "",
      notes: c.notes || "",
      status: "unassigned",
      is_archived: false,
    }));
    await base44.asServiceRole.entities.ContactLead.bulkCreate(batch);
    created += batch.length;
  }

  const freshLeads = await base44.asServiceRole.entities.ContactLead.filter({ package_id: pkg.id });
  await base44.asServiceRole.entities.ContactPackage.update(pkg.id, {
    total_count: freshLeads.length,
    assigned_count: freshLeads.filter(l => l.assigned_user_email).length,
  });

  return Response.json({ success: true, package_id: pkg.id, created });
});