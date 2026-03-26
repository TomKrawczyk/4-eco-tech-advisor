import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Przy zmianie nazwy grupy synchronizuje group_name w SheetGroupMapping i MeetingAssignment (cache)
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { groupId, newName } = await req.json();
  if (!groupId || !newName) {
    return Response.json({ error: 'groupId i newName są wymagane' }, { status: 400 });
  }

  // 1. Zaktualizuj SheetGroupMapping
  const mappings = await base44.asServiceRole.entities.SheetGroupMapping.filter({ group_id: groupId });
  for (const m of mappings) {
    await base44.asServiceRole.entities.SheetGroupMapping.update(m.id, { group_name: newName });
  }

  // 2. Zaktualizuj MeetingAssignment (cache)
  const assignments = await base44.asServiceRole.entities.MeetingAssignment.filter({ assigned_group_id: groupId });
  for (const a of assignments) {
    await base44.asServiceRole.entities.MeetingAssignment.update(a.id, { assigned_group_name: newName });
  }

  // 3. Zaktualizuj PhoneContact (cache)
  const contacts = await base44.asServiceRole.entities.PhoneContact.filter({ assigned_group_id: groupId });
  for (const c of contacts) {
    await base44.asServiceRole.entities.PhoneContact.update(c.id, { assigned_group_name: newName });
  }

  return Response.json({
    success: true,
    updated: {
      sheetMappings: mappings.length,
      meetingAssignments: assignments.length,
      phoneContacts: contacts.length,
    }
  });
});