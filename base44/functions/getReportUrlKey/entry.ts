import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const FB_PREFIX = 'manual_facebook_';
const isFb = (k) => !!k && String(k).toLowerCase().startsWith(FB_PREFIX);
const em = (x) => (x || '').trim().toLowerCase();

function localYMD(d) {
  if (!d) return '';
  const dt = new Date(d);
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(dt);
}
async function fetchAll(entity) {
  const out = []; let skip = 0; const limit = 500;
  while (true) {
    const batch = await entity.list('-created_date', limit, skip);
    if (!batch || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < limit) break;
    skip += limit; if (skip > 50000) break;
  }
  return out;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);
    let body = {};
    try { body = await req.json(); } catch (_) {}
    const provided = body?.key || url.searchParams.get('key') || req.headers.get('x-report-key') || '';
    const expected = Deno.env.get('REPORT_KEY') || '';
    if (!expected || provided !== expected) {
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }
    const date = body?.date || url.searchParams.get('date') || localYMD(new Date());
    const svc = base44.asServiceRole.entities;
    const [allowedUsers, groups, meetingAssign, meetingReports, phoneContacts, phoneReports] = await Promise.all([
      fetchAll(svc.AllowedUser), fetchAll(svc.Group),
      fetchAll(svc.MeetingAssignment), fetchAll(svc.MeetingReport),
      fetchAll(svc.PhoneContact), fetchAll(svc.PhoneContactReport),
    ]);
    const groupName = {};
    for (const g of groups) groupName[g.id] = g.name;
    const TEST_GROUP = '69f255b4e42c9888fdf5f496';
    const advisorsByEmail = {};
    for (const u of allowedUsers) {
      if ((u.role === 'advisor' || u.role === 'group_leader') && u.group_id !== TEST_GROUP) {
        advisorsByEmail[em(u.email)] = { name: u.name || '', group: u.group_id ? (groupName[u.group_id] || '') : '' };
      }
    }
    const advGroup = {};
    for (const e of Object.keys(advisorsByEmail)) advGroup[e] = advisorsByEmail[e].group;

    const groupOf = (r) => {
      const g = (r.assigned_group_name || '').trim();
      if (g) return g;
      const byMail = advGroup[em(r.assigned_user_email)] || advGroup[em(r.author_email)] || '';
      return byMail.trim();
    };

    const A = {
      meetings_assigned: meetingAssign.filter((r) => r.meeting_date === date),
      meeting_reports: meetingReports.filter((r) => r.meeting_date === date),
      phone_assigned: phoneContacts.filter((r) => r.contact_date === date),
      phone_reported: phoneReports.filter((r) => r.contact_date === date),
    };
    const B = {
      meeting_reports: meetingReports.filter((r) => localYMD(r.created_date) === date),
      phone_reported: phoneReports.filter((r) => localYMD(r.created_date) === date),
    };

    const perGroup = {};
    const unassigned = { sa: 0, sr: 0, pa: 0, pr: 0, fb: 0 };
    const bucket = (g) => g ? (perGroup[g] = perGroup[g] || { sa: 0, sr: 0, pa: 0, pr: 0, fb: 0 }) : unassigned;
    for (const r of A.meetings_assigned) bucket(groupOf(r)).sa++;
    for (const r of A.meeting_reports) bucket(groupOf(r)).sr++;
    for (const r of A.phone_assigned) { const b = bucket(groupOf(r)); b.pa++; if (isFb(r.contact_key)) b.fb++; }
    for (const r of A.phone_reported) bucket(groupOf(r)).pr++;

    const perPersonA = {};
    const eP = (e) => (perPersonA[e] = perPersonA[e] || { sa: 0, sr: 0, pa: 0, pr: 0, fb: 0 });
    for (const r of A.meetings_assigned) { const e = em(r.assigned_user_email); if (e) eP(e).sa++; }
    for (const r of A.meeting_reports) { const e = em(r.author_email); if (e) eP(e).sr++; }
    for (const r of A.phone_assigned) { const e = em(r.assigned_user_email); if (e) { eP(e).pa++; if (isFb(r.contact_key)) eP(e).fb++; } }
    for (const r of A.phone_reported) { const e = em(r.author_email); if (e) eP(e).pr++; }
    const perPersonB = {};
    const eB = (e) => (perPersonB[e] = perPersonB[e] || { sr: 0, pr: 0 });
    for (const r of B.meeting_reports) { const e = em(r.author_email); if (e) eB(e).sr++; }
    for (const r of B.phone_reported) { const e = em(r.author_email); if (e) eB(e).pr++; }

    const fbAssigned = A.phone_assigned.filter((r) => isFb(r.contact_key));
    const fbReported = A.phone_reported.filter((r) => isFb(r.contact_key));
    const fbByGroup = {};
    for (const r of fbAssigned) { const g = groupOf(r) || '(nieprzypisane)'; fbByGroup[g] = (fbByGroup[g] || 0) + 1; }
    const facebook = {
      assigned: fbAssigned.length,
      reported: fbReported.length,
      byGroup: fbByGroup,
    };

    const result = {
      report_date: date, generated_at: new Date().toISOString(), advisorsByEmail,
      totals_A: { meetings_assigned: A.meetings_assigned.length, meeting_reports: A.meeting_reports.length, phone_assigned: A.phone_assigned.length, phone_reported: A.phone_reported.length, facebook: fbAssigned.length },
      totals_B: { meeting_reports: B.meeting_reports.length, phone_reported: B.phone_reported.length },
      perGroup, unassigned, perPersonA, perPersonB, facebook,
    };

    if (body?.agg) {
      const slim = { ...result };
      delete slim.advisorsByEmail;
      return new Response(JSON.stringify(slim, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500 });
  }
});