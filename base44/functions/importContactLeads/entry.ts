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
  }

  // Lista handlowców dla paczki prywatnej (max 2) — nowy format assigned_users lub stary assigned_user_email
  let assignedUsers = Array.isArray(packageMeta?.assigned_users) ? packageMeta.assigned_users.filter(u => u?.email) : [];
  if (assignedUsers.length === 0 && packageMeta?.assigned_user_email) {
    assignedUsers = [{ email: packageMeta.assigned_user_email, name: packageMeta.assigned_user_name || "" }];
  }
  assignedUsers = assignedUsers.slice(0, 2);

  if (!pkg) {
    const isPrivate = assignedUsers.length > 0;
    if (!packageMeta.group_id && !isPrivate) {
      return Response.json({ error: 'Brak przypisanej grupy. Skontaktuj się z administratorem.' }, { status: 400 });
    }

    // Utwórz paczkę
    pkg = await base44.asServiceRole.entities.ContactPackage.create({
      name: packageMeta.name,
      description: packageMeta.description || "",
      group_id: isPrivate ? "" : packageMeta.group_id,
      group_name: isPrivate ? "" : (packageMeta.group_name || ""),
      is_private: isPrivate,
      assigned_user_email: assignedUsers[0]?.email || "",
      assigned_user_name: assignedUsers.map(u => u.name || u.email).join(", "),
      assigned_user_emails: assignedUsers.map(u => u.email),
      created_by_email: user.email,
      created_by_name: packageMeta.created_by_name || "",
      total_count: 0,
      assigned_count: 0,
      status: "active",
    });
  } else if (pkg.is_private && assignedUsers.length === 0) {
    // Doimport do istniejącej paczki prywatnej — użyj jej handlowców
    const emails = (pkg.assigned_user_emails && pkg.assigned_user_emails.length > 0) ? pkg.assigned_user_emails : (pkg.assigned_user_email ? [pkg.assigned_user_email] : []);
    const names = (pkg.assigned_user_name || "").split(",").map(s => s.trim());
    assignedUsers = emails.map((email, i) => ({ email, name: names[i] || "" }));
  }

  // Bulk insert partiami po 100 — przy 2 handlowcach kontakty dzielone naprzemiennie
  const BATCH = 100;
  let created = 0;
  const isPrivatePkg = pkg.is_private && assignedUsers.length > 0;
  const nowIso = new Date().toISOString();
  for (let i = 0; i < contacts.length; i += BATCH) {
    const batch = contacts.slice(i, i + BATCH).map((c, j) => {
      const assignee = isPrivatePkg ? assignedUsers[(i + j) % assignedUsers.length] : null;
      const base = {
      package_id: pkg.id,
      group_id: pkg.group_id || packageMeta?.group_id || "",
      client_name: c.client_name || "",
      client_phone: c.client_phone || "",
      client_address: c.client_address || "",
      postal_code: c.postal_code || "",
      notes: c.notes || "",
      extra_data: c.extra_data || {},
      status: assignee ? "assigned" : "unassigned",
      assigned_user_email: assignee?.email || "",
      assigned_user_name: assignee?.name || "",
      is_archived: false,
      };
      if (assignee) base.assigned_at = nowIso;
      return base;
    });
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