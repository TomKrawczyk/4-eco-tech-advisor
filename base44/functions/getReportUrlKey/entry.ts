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
    const debug = !!body?.debug;
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
        advisorsByEmail[em(u.email)] = { name: u.name || '', group: u.group_id ? (groupName[u.group_id] || '—') : '—' };
      }
    }
    const advGroup = {};
    for (const e of Object.keys(advisorsByEmail)) advGroup[e] = advisorsByEmail[e].group;
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

    if (debug) {
      const sample = (arr, fields, n = 5) => arr.slice(0, n).map(r => { const o = {}; for (const f of fields) o[f] = r[f]; return o; });
      const distinct = (arr, f) => { const s = {}; for (const r of arr) { const k = String(r[f] ?? 'NULL'); s[k] = (s[k] || 0) + 1; } return s; };
      const fbPhone = phoneContacts.filter(r => isFb(r.contact_key));
      const fbToday = A.phone_assigned.filter(r => isFb(r.contact_key));
      const dbg = {
        date,
        counts: {
          allowedUsers: allowedUsers.length, groups: groups.length,
          meetingAssign_total: meetingAssign.length, meetingAssign_today: A.meetings_assigned.length,
          phoneContacts_total: phoneContacts.length, phoneContacts_today: A.phone_assigned.length,
          fbPhone_total: fbPhone.length, fbPhone_today: fbToday.length,
        },
        meetingAssign_groupName_distinct_today: distinct(A.meetings_assigned, 'assigned_group_name'),
        phoneAssign_groupName_distinct_today: distinct(A.phone_assigned, 'assigned_group_name'),
        meetingAssign_keys: meetingAssign[0] ? Object.keys(meetingAssign[0]) : [],
        phoneContact_keys: phoneContacts[0] ? Object.keys(phoneContacts[0]) : [],
        phoneReport_keys: phoneReports[0] ? Object.keys(phoneReports[0]) : [],
        meetingAssign_sample: sample(A.meetings_assigned, ['assigned_group_name', 'assigned_user_email', 'meeting_date', 'status'], 6),
        fbPhone_sample: sample(fbPhone, ['contact_key', 'assigned_group_name', 'assigned_user_email', 'contact_date'], 8),
        groupNames: groups.map(g => ({ id: g.id, name: g.name })),
      };
      return new Response(JSON.stringify(dbg, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    const gkey = (x) => (x || '— bez grupy —');
    const perGroup = {};
    const ensureG = (g) => (perGroup[g] = perGroup[g] || { sa: 0, sr: 0, pa: 0, pr: 0, fb: 0 });
    for (const r of A.meetings_assigned) ensureG(gkey(r.assigned_group_name)).sa++;
    for (const r of A.phone_assigned) { const g = ensureG(gkey(r.assigned_group_name)); g.pa++; if (isFb(r.contact_key)) g.fb++; }
    for (const r of A.meeting_reports) ensureG(advGroup[em(r.author_email)] || '— bez grupy —').sr++;
    for (const r of A.phone_reported) ensureG(advGroup[em(r.author_email)] || '— bez grupy —').pr++;
    const perPersonA = {};
    const eP = (e) => (perPersonA[e] = perPersonA[e] || { sa: 0, sr: 0, pa: 0, pr: 0 });
    for (const r of A.meetings_assigned) { const e = em(r.assigned_user_email); if (e) eP(e).sa++; }
    for (const r of A.meeting_reports) { const e = em(r.author_email); if (e) eP(e).sr++; }
    for (const r of A.phone_assigned) { const e = em(r.assigned_user_email); if (e) eP(e).pa++; }
    for (const r of A.phone_reported) { const e = em(r.author_email); if (e) eP(e).pr++; }
    const perPersonB = {};
    const eB = (e) => (perPersonB[e] = perPersonB[e] || { sr: 0, pr: 0 });
    for (const r of B.meeting_reports) { const e = em(r.author_email); if (e) eB(e).sr++; }
    for (const r of B.phone_reported) { const e = em(r.author_email); if (e) eB(e).pr++; }
    const fbCount = A.phone_assigned.filter((r) => isFb(r.contact_key)).length;
    const result = {
      report_date: date, generated_at: new Date().toISOString(), advisorsByEmail,
      totals_A: { meetings_assigned: A.meetings_assigned.length, meeting_reports: A.meeting_reports.length, phone_assigned: A.phone_assigned.length, phone_reported: A.phone_reported.length, facebook: fbCount },
      totals_B: { meeting_reports: B.meeting_reports.length, phone_reported: B.phone_reported.length },
      perGroup, perPersonA, perPersonB,
    };
    return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500 });
  }
});