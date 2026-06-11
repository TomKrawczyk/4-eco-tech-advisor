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
    if (!(await base44.auth.isAuthenticated())) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
    let body = {};
    try { body = await req.json(); } catch (_) {}
    const date = body?.date || localYMD(new Date());
    const compact = body?.compact === true;
    const saveToStorage = body?.save_to_storage === true;
    const svc = base44.asServiceRole.entities;
    const [allowedUsers, groups, meetingAssign, meetingReports, phoneContacts, phoneReports] = await Promise.all([
      fetchAll(svc.AllowedUser), fetchAll(svc.Group),
      fetchAll(svc.MeetingAssignment), fetchAll(svc.MeetingReport),
      fetchAll(svc.PhoneContact), fetchAll(svc.PhoneContactReport),
    ]);
    const groupName = {};
    for (const g of groups) groupName[g.id] = g.name;
    const TEST_GROUP = '69f255b4e42c9888fdf5f496';
    const advisors = allowedUsers
      .filter((u) => (u.role === 'advisor' || u.role === 'group_leader') && u.group_id !== TEST_GROUP)
      .map((u) => ({ name: u.name || '', email: (u.email || '').trim(), role: u.role, group: u.group_id ? (groupName[u.group_id] || '—') : '—' }));
    const advisorsByEmail = {};
    const advGroup = {};
    for (const a of advisors) {
      const emailKey = em(a.email);
      if (!emailKey) continue;
      advisorsByEmail[emailKey] = { name: a.name, group: a.group };
      advGroup[emailKey] = a.group;
    }

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

    const gkey = (x) => (x || '— bez grupy —');
    const perGroup = {};
    const ensureG = (g) => (perGroup[g] = perGroup[g] || { sa: 0, sr: 0, pa: 0, pr: 0, fb: 0 });
    for (const r of A.meetings_assigned) ensureG(gkey(r.assigned_group_name)).sa++;
    for (const r of A.phone_assigned) { const g = ensureG(gkey(r.assigned_group_name)); g.pa++; if (isFb(r.contact_key)) g.fb++; }
    for (const r of A.meeting_reports) ensureG(advGroup[em(r.author_email)] || '— bez grupy —').sr++;
    for (const r of A.phone_reported) ensureG(advGroup[em(r.author_email)] || '— bez grupy —').pr++;

    const perPersonA = {};
    const ensureP = (e) => (perPersonA[e] = perPersonA[e] || { sa: 0, sr: 0, pa: 0, pr: 0 });
    for (const r of A.meetings_assigned) { const e = em(r.assigned_user_email); if (e) ensureP(e).sa++; }
    for (const r of A.meeting_reports) { const e = em(r.author_email); if (e) ensureP(e).sr++; }
    for (const r of A.phone_assigned) { const e = em(r.assigned_user_email); if (e) ensureP(e).pa++; }
    for (const r of A.phone_reported) { const e = em(r.author_email); if (e) ensureP(e).pr++; }

    const perPersonB = {};
    const ensureB = (e) => (perPersonB[e] = perPersonB[e] || { sr: 0, pr: 0 });
    for (const r of B.meeting_reports) { const e = em(r.author_email); if (e) ensureB(e).sr++; }
    for (const r of B.phone_reported) { const e = em(r.author_email); if (e) ensureB(e).pr++; }

    const fbCount = A.phone_assigned.filter((r) => isFb(r.contact_key)).length;
    const generatedAt = new Date().toISOString();

    const compactResponseBody = {
      report_date: date,
      generated_at: generatedAt,
      advisorsByEmail,
      totals_A: { meetings_assigned: A.meetings_assigned.length, meeting_reports: A.meeting_reports.length, phone_assigned: A.phone_assigned.length, phone_reported: A.phone_reported.length, facebook: fbCount },
      totals_B: { meeting_reports: B.meeting_reports.length, phone_reported: B.phone_reported.length },
      perGroup,
      perPersonA,
      perPersonB,
    };

    const responseBody = compact
      ? compactResponseBody
      : {
          report_date: date,
          generated_at: generatedAt,
          advisors,
          totals_A: compactResponseBody.totals_A,
          totals_B: compactResponseBody.totals_B,
          perGroup,
          perPersonA,
          perPersonB,
        };

    if (saveToStorage) {
      try {
        const jsonFile = new File(
          [JSON.stringify(compactResponseBody, null, 2)],
          `raport_dane_${date}.json`,
          { type: 'application/json' }
        );
        const uploadResult = await base44.integrations.Core.UploadFile({ file: jsonFile });
        if (uploadResult?.file_url) responseBody.file_url = uploadResult.file_url;
      } catch (_) {}
    }

    return new Response(JSON.stringify(responseBody), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500 });
  }
});