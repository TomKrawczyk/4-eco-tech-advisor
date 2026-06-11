import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const FB_PREFIX = 'manual_facebook_';
const isFb = (k) => !!k && String(k).toLowerCase().startsWith(FB_PREFIX);

function localYMD(d) {
  if (!d) return '';
  const dt = new Date(d);
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return fmt.format(dt);
}

async function fetchAll(entity) {
  const out = [];
  let skip = 0;
  const limit = 500;
  while (true) {
    const batch = await entity.list('-created_date', limit, skip);
    if (!batch || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < limit) break;
    skip += limit;
    if (skip > 50000) break;
  }
  return out;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    if (!(await base44.auth.isAuthenticated())) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
    }
    let body = {};
    try { body = await req.json(); } catch (_) {}
    const date = body?.date || localYMD(new Date());
    const svc = base44.asServiceRole.entities;
    const [allowedUsers, groups, meetingAssign, meetingReports, phoneContacts, phoneReports] =
      await Promise.all([
        fetchAll(svc.AllowedUser), fetchAll(svc.Group),
        fetchAll(svc.MeetingAssignment), fetchAll(svc.MeetingReport),
        fetchAll(svc.PhoneContact), fetchAll(svc.PhoneContactReport),
      ]);
    const groupName = {};
    for (const g of groups) groupName[g.id] = g.name;
    const TEST_GROUP = '69f255b4e42c9888fdf5f496';
    const advisors = allowedUsers
      .filter((u) => (u.role === 'advisor' || u.role === 'group_leader') && u.group_id !== TEST_GROUP)
      .map((u) => ({
        name: u.name || '', email: (u.email || '').trim(), role: u.role,
        group: u.group_id ? (groupName[u.group_id] || '—') : '—',
      }));
    const slimAssign = (r) => ({
      email: r.assigned_user_email || null,
      group: r.assigned_group_name || (r.assigned_group_id ? groupName[r.assigned_group_id] : null),
      contact_key: r.contact_key || null,
    });
    const slimReport = (r) => ({
      author: r.author_name || '', email: r.author_email || '',
      status: r.status || null, contact_key: r.contact_key || null,
    });
    const A = {
      meetings_assigned: meetingAssign.filter((r) => r.meeting_date === date).map(slimAssign),
      meeting_reports: meetingReports.filter((r) => r.meeting_date === date).map(slimReport),
      phone_assigned: phoneContacts.filter((r) => r.contact_date === date).map(slimAssign),
      phone_reported: phoneReports.filter((r) => r.contact_date === date).map(slimReport),
    };
    const B = {
      meetings_assigned: meetingAssign.filter((r) => localYMD(r.created_date) === date).map(slimAssign),
      meeting_reports: meetingReports.filter((r) => localYMD(r.created_date) === date).map(slimReport),
      phone_assigned: phoneContacts.filter((r) => localYMD(r.created_date) === date).map(slimAssign),
      phone_reported: phoneReports.filter((r) => localYMD(r.created_date) === date).map(slimReport),
    };
    return new Response(JSON.stringify({ report_date: date, generated_at: new Date().toISOString(), advisors, A, B }),
      { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500 });
  }
});