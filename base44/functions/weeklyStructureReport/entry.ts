import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function localYMD(d) {
  if (!d) return '';
  const dt = new Date(d);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(dt);
}

function prevWeek() {
  const now = new Date();
  const ymd = localYMD(now);
  const base = new Date(`${ymd}T12:00:00Z`);
  const dow = (base.getUTCDay() + 6) % 7;
  const thisMon = new Date(base);
  thisMon.setUTCDate(base.getUTCDate() - dow);
  const lastMon = new Date(thisMon);
  lastMon.setUTCDate(thisMon.getUTCDate() - 7);
  const lastSun = new Date(lastMon);
  lastSun.setUTCDate(lastMon.getUTCDate() + 6);
  return { from: localYMD(lastMon), to: localYMD(lastSun) };
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
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let body = {};
    try {
      body = await req.json();
    } catch (_) {}

    const pw = prevWeek();
    const from = body?.from || pw.from;
    const to = body?.to || pw.to;
    const inRange = (d) => !!d && d >= from && d <= to;

    const svc = base44.asServiceRole.entities;
    const [allowedUsers, groups, meetingAssign, meetingReports, phoneContacts, phoneReports] =
      await Promise.all([
        fetchAll(svc.AllowedUser),
        fetchAll(svc.Group),
        fetchAll(svc.MeetingAssignment),
        fetchAll(svc.MeetingReport),
        fetchAll(svc.PhoneContact),
        fetchAll(svc.PhoneContactReport),
      ]);

    const groupName = {};
    for (const g of groups) groupName[g.id] = g.name;

    const TEST_GROUP = '69f255b4e42c9888fdf5f496';
    const email2name = {};
    const advisorsList = [];

    for (const u of allowedUsers) {
      if ((u.role === 'advisor' || u.role === 'group_leader') && u.group_id !== TEST_GROUP) {
        const grp = u.group_id ? (groupName[u.group_id] || '—') : '—';
        const em = (u.email || '').trim().toLowerCase();
        if (em) email2name[em] = u.name || em;
        advisorsList.push({ name: u.name || '', email: em, group: grp });
      }
    }

    const grpOf = (r) =>
      (r.assigned_group_name || (r.assigned_group_id ? groupName[r.assigned_group_id] : '') || '').trim() || 'Bez struktury';

    const S = {};
    const get = (name) => (S[name] ||= {
      name,
      meetings_assigned: 0,
      meeting_reports: 0,
      phone_assigned: 0,
      phone_reported: 0,
      advisors: 0,
      people: {},
    });

    for (const r of meetingAssign) {
      if (!inRange(r.meeting_date)) continue;
      const a = get(grpOf(r));
      a.meetings_assigned++;
      const em = (r.assigned_user_email || '').trim().toLowerCase();
      const key = em || '__nieprzypisany__';
      a.people[key] = (a.people[key] || 0) + 1;
    }

    for (const r of meetingReports) {
      if (inRange(r.meeting_date)) get(grpOf(r)).meeting_reports++;
    }

    for (const r of phoneContacts) {
      if (inRange(r.contact_date)) get(grpOf(r)).phone_assigned++;
    }

    for (const r of phoneReports) {
      if (inRange(r.contact_date)) get(grpOf(r)).phone_reported++;
    }

    for (const u of advisorsList) {
      if (u.group && u.group !== '—') get(u.group).advisors++;
    }

    const structures = Object.values(S)
      .map((a) => ({
        name: a.name,
        metrics: {
          meetings_assigned: a.meetings_assigned,
          meeting_reports: a.meeting_reports,
          phone_assigned: a.phone_assigned,
          phone_reported: a.phone_reported,
          advisors: a.advisors,
        },
        advisors_assigned: Object.entries(a.people)
          .map(([em, n]) => ({
            name: em === '__nieprzypisany__' ? '— nieprzypisany —' : (email2name[em] || em),
            email: em === '__nieprzypisany__' ? null : em,
            assigned: n,
          }))
          .sort((x, y) => y.assigned - x.assigned),
      }))
      .sort((x, y) => y.metrics.meetings_assigned - x.metrics.meetings_assigned);

    const totals = structures.reduce(
      (t, s) => {
        t.meetings_assigned += s.metrics.meetings_assigned;
        t.meeting_reports += s.metrics.meeting_reports;
        t.phone_assigned += s.metrics.phone_assigned;
        t.phone_reported += s.metrics.phone_reported;
        return t;
      },
      { meetings_assigned: 0, meeting_reports: 0, phone_assigned: 0, phone_reported: 0 }
    );

    return new Response(
      JSON.stringify({ from, to, generated_at: new Date().toISOString(), totals, structures }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});