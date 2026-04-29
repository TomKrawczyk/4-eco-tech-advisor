import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { packageMeta, contacts } = await req.json();

  // Utwórz paczkę
  const pkg = await base44.asServiceRole.entities.ContactPackage.create({
    name: packageMeta.name,
    description: packageMeta.description || "",
    group_id: packageMeta.group_id,
    group_name: packageMeta.group_name || "",
    created_by_email: user.email,
    created_by_name: packageMeta.created_by_name || "",
    total_count: contacts.length,
    assigned_count: 0,
    status: "active",
  });

  // Bulk insert partiami po 100
  const BATCH = 100;
  let created = 0;
  for (let i = 0; i < contacts.length; i += BATCH) {
    const batch = contacts.slice(i, i + BATCH).map(c => ({
      package_id: pkg.id,
      group_id: packageMeta.group_id,
      client_name: c.client_name || "",
      client_phone: c.client_phone || "",
      client_address: c.client_address || "",
      notes: c.notes || "",
      status: "unassigned",
    }));
    await base44.asServiceRole.entities.ContactLead.bulkCreate(batch);
    created += batch.length;
  }

  return Response.json({ success: true, package_id: pkg.id, created });
});