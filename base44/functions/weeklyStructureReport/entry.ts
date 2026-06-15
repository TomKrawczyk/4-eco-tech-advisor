import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function pickFirstPhone(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const first = text.split(/[\n,;\/|]+/).map((part) => part.trim()).find(Boolean);
  return first || text;
}

function last9(value) {
  return pickFirstPhone(value).replace(/\D/g, '').slice(-9);
}

function localYMD(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    const isoMatch = value.match(/\d{4}-\d{2}-\d{2}/);
    if (isoMatch) return isoMatch[0];
    const plMatch = value.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
    if (plMatch) {
      const day = plMatch[1].padStart(2, '0');
      const month = plMatch[2].padStart(2, '0');
      return `${plMatch[3]}-${month}-${day}`;
    }
  }
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(dt);
}

function getContactDate(record) {
  return record.contact_date || localYMD(record.contact_calendar) || localYMD(record.date) || '';
}

function makePhoneDateKey(phone, date) {
  const normalizedPhone = last9(phone);
  return normalizedPhone && date ? `${normalizedPhone}__${date}` : '';
}

function normalizeKey(value) {
  return String(value || '').trim();
}

function prevWeek() {
  const now = new Date();
  const base = new Date(`${localYMD(now)}T12:00:00Z`);
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
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
    }

    let body = {};
    try {
      body = await req.json();
    } catch (_) {}

    const pw = prevWeek();
    const from = body?.from || pw.from;
    const to = body?.to || pw.to;
    const inRange = (date) => !!date && date >= from && date <= to;

    const svc = base44.asServiceRole.entities;
    const [allowedUsers, groups, meetingAssignments, meetingReports, phoneContacts, phoneReports] = await Promise.all([
      fetchAll(svc.AllowedUser),
      fetchAll(svc.Group),
      fetchAll(svc.MeetingAssignment),
      fetchAll(svc.MeetingReport),
      fetchAll(svc.PhoneContact),
      fetchAll(svc.PhoneContactReport),
    ]);

    const groupNameById = {};
    for (const group of groups) {
      groupNameById[group.id] = group.name || 'Bez struktury';
    }

    const TEST_GROUP = '69f255b4e42c9888fdf5f496';
    const emailToName = {};
    const emailToGroup = {};
    const emailToRole = {};
    const advisorsList = [];

    for (const user of allowedUsers) {
      if ((user.role === 'advisor' || user.role === 'group_leader' || user.role === 'team_leader') && user.group_id !== TEST_GROUP) {
        const groupName = user.group_id ? (groupNameById[user.group_id] || '—') : '—';
        const email = (user.email || '').trim().toLowerCase();
        if (email) {
          emailToName[email] = user.name || email;
          emailToGroup[email] = groupName;
          emailToRole[email] = user.role || '';
        }
        advisorsList.push({ name: user.name || '', email, group: groupName });
      }
    }

    const groupOfAssigned = (record) => {
      return (record.assigned_group_name || (record.assigned_group_id ? groupNameById[record.assigned_group_id] : '') || '').trim() || 'Bez struktury';
    };

    const groupOfReport = (record) => {
      const email = (record.author_email || '').trim().toLowerCase();
      return email && emailToGroup[email] ? emailToGroup[email] : 'Bez struktury';
    };

    const meetingReportByPhone = {};
    for (const report of meetingReports) {
      const phone = last9(report.client_phone);
      if (phone && !meetingReportByPhone[phone]) {
        meetingReportByPhone[phone] = (report.status || 'reported').toLowerCase();
      }
    }

    const phoneReportedKeys = new Set();
    const phoneReportStatusByKey = {};
    const phoneReportByPhone = {};
    for (const report of phoneReports) {
      const contactKey = normalizeKey(report.contact_key);
      if (contactKey) {
        phoneReportedKeys.add(contactKey);
        if (!phoneReportStatusByKey[contactKey]) {
          phoneReportStatusByKey[contactKey] = normalizeKey(report.result).toLowerCase() || null;
        }
      }
      const phone = last9(report.client_phone);
      if (phone && !phoneReportByPhone[phone]) {
        phoneReportByPhone[phone] = normalizeKey(report.result).toLowerCase() || null;
      }
    }

    const structuresMap = {};
    const getStructure = (name) => {
      if (!structuresMap[name]) {
        structuresMap[name] = {
          name,
          meetings_assigned: 0,
          meeting_reports: 0,
          reports_completed: 0,
          reports_planned: 0,
          phone_contacts_assigned: 0,
          phone_contacts_reported: 0,
          phone_contacts_missing: 0,
          advisors: 0,
          people: {},
          reporters: {},
          clients: [],
          phone_contacts: [],
        };
      }
      return structuresMap[name];
    };

    for (const assignment of meetingAssignments) {
      if (!inRange(assignment.meeting_date)) continue;
      const structure = getStructure(groupOfAssigned(assignment));
      structure.meetings_assigned++;
      const advisorEmail = (assignment.assigned_user_email || '').trim().toLowerCase();
      const peopleKey = advisorEmail || '__nieprzypisany__';
      structure.people[peopleKey] = (structure.people[peopleKey] || 0) + 1;
      const reportStatus = assignment.client_phone ? meetingReportByPhone[last9(assignment.client_phone)] : '';
      structure.clients.push({
        client_name: assignment.client_name || '—',
        client_phone: assignment.client_phone || '',
        client_address: assignment.client_address || '',
        meeting_date: assignment.meeting_date || '',
        meeting_calendar: assignment.meeting_calendar || assignment.meeting_date || '',
        advisor_name: assignment.assigned_user_name || (advisorEmail ? (emailToName[advisorEmail] || advisorEmail) : '— nieprzypisany —'),
        advisor_email: advisorEmail || null,
        reported: !!reportStatus,
        report_status: reportStatus || null,
      });
    }

    for (const report of meetingReports) {
      if (!inRange(report.meeting_date)) continue;
      const structure = getStructure(groupOfReport(report));
      structure.meeting_reports++;
      const status = (report.status || '').toLowerCase();
      if (status === 'completed') structure.reports_completed++;
      if (status === 'planned') structure.reports_planned++;
      const reporterEmail = (report.author_email || '').trim().toLowerCase();
      const reporterKey = reporterEmail || '__nieznany__';
      structure.reporters[reporterKey] = (structure.reporters[reporterKey] || 0) + 1;
    }

    for (const contact of phoneContacts) {
      const contactDate = getContactDate(contact);
      if (!inRange(contactDate) || contact.is_archived === true) continue;
      const structure = getStructure(groupOfAssigned(contact));
      structure.phone_contacts_assigned++;
      const advisorEmail = (contact.assigned_user_email || '').trim().toLowerCase();
      const contactKey = normalizeKey(contact.contact_key);
      const phone = last9(contact.phone);
      const exactReportStatus = contactKey ? phoneReportStatusByKey[contactKey] : null;
      const fallbackReportStatus = !contactKey && phone ? phoneReportByPhone[phone] : null;
      const reported = (contactKey && phoneReportedKeys.has(contactKey)) || (!contactKey && !!fallbackReportStatus);
      const reportStatus = exactReportStatus || fallbackReportStatus || null;
      if (reported) structure.phone_contacts_reported++;
      else structure.phone_contacts_missing++;
      structure.phone_contacts.push({
        client_name: contact.client_name || '—',
        client_phone: contact.phone || '',
        client_address: contact.address || '',
        contact_date: contactDate,
        contact_calendar: contact.contact_calendar || contactDate || '',
        advisor_name: contact.assigned_user_name || (advisorEmail ? (emailToName[advisorEmail] || advisorEmail) : '— nieprzypisany —'),
        advisor_email: advisorEmail || null,
        reported,
        report_status: reportStatus,
      });
    }

    for (const advisor of advisorsList) {
      if (advisor.group && advisor.group !== '—') getStructure(advisor.group).advisors++;
    }

    const structures = Object.values(structuresMap).map((structure) => {
      const meetingCoverage = structure.meetings_assigned > 0
        ? Math.round((structure.meeting_reports / structure.meetings_assigned) * 100)
        : null;
      const phoneCoverage = structure.phone_contacts_assigned > 0
        ? Math.round((structure.phone_contacts_reported / structure.phone_contacts_assigned) * 100)
        : null;

      return {
        name: structure.name,
        metrics: {
          meetings_assigned: structure.meetings_assigned,
          meeting_reports: structure.meeting_reports,
          reports_completed: structure.reports_completed,
          reports_planned: structure.reports_planned,
          report_coverage_pct: meetingCoverage,
          missing_reports: structure.meetings_assigned > 0 ? Math.max(0, structure.meetings_assigned - structure.meeting_reports) : 0,
          phone_contacts_assigned: structure.phone_contacts_assigned,
          phone_contacts_reported: structure.phone_contacts_reported,
          phone_contacts_coverage_pct: phoneCoverage,
          phone_contacts_missing: structure.phone_contacts_missing,
          phone_assigned: structure.phone_contacts_assigned,
          phone_reported: structure.phone_contacts_reported,
          advisors: structure.advisors,
        },
        advisors_assigned: Object.entries(structure.people)
          .map(([email, assigned]) => ({
            name: email === '__nieprzypisany__' ? '— nieprzypisany —' : (emailToName[email] || email),
            email: email === '__nieprzypisany__' ? null : email,
            role: email === '__nieprzypisany__' ? null : (emailToRole[email] || null),
            assigned,
          }))
          .sort((a, b) => b.assigned - a.assigned),
        reporters: Object.entries(structure.reporters)
          .map(([email, reports]) => ({
            name: email === '__nieznany__' ? '— nieznany —' : (emailToName[email] || email),
            email: email === '__nieznany__' ? null : email,
            role: email === '__nieznany__' ? null : (emailToRole[email] || null),
            reports,
          }))
          .sort((a, b) => b.reports - a.reports),
        clients: structure.clients.sort((a, b) => {
          if (a.reported !== b.reported) return a.reported ? 1 : -1;
          return String(a.meeting_calendar).localeCompare(String(b.meeting_calendar));
        }),
        phone_contacts: structure.phone_contacts.sort((a, b) => {
          if (a.reported !== b.reported) return a.reported ? 1 : -1;
          return String(a.contact_calendar || a.contact_date).localeCompare(String(b.contact_calendar || b.contact_date));
        }),
      };
    }).sort((a, b) => yCompare(b.metrics.meetings_assigned + b.metrics.phone_contacts_assigned, a.metrics.meetings_assigned + a.metrics.phone_contacts_assigned));

    const totals = structures.reduce((acc, structure) => {
      acc.meetings_assigned += structure.metrics.meetings_assigned;
      acc.meeting_reports += structure.metrics.meeting_reports;
      acc.reports_completed += structure.metrics.reports_completed;
      acc.phone_contacts_assigned += structure.metrics.phone_contacts_assigned;
      acc.phone_contacts_reported += structure.metrics.phone_contacts_reported;
      acc.phone_contacts_missing += structure.metrics.phone_contacts_missing;
      return acc;
    }, {
      meetings_assigned: 0,
      meeting_reports: 0,
      reports_completed: 0,
      phone_contacts_assigned: 0,
      phone_contacts_reported: 0,
      phone_contacts_missing: 0,
    });

    totals.report_coverage_pct = totals.meetings_assigned > 0
      ? Math.round((totals.meeting_reports / totals.meetings_assigned) * 100)
      : null;
    totals.phone_contacts_coverage_pct = totals.phone_contacts_assigned > 0
      ? Math.round((totals.phone_contacts_reported / totals.phone_contacts_assigned) * 100)
      : null;
    totals.phone_assigned = totals.phone_contacts_assigned;
    totals.phone_reported = totals.phone_contacts_reported;

    return new Response(JSON.stringify({
      from,
      to,
      generated_at: new Date().toISOString(),
      totals,
      structures,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error?.message || error) }), { status: 500 });
  }
});

function yCompare(left, right) {
  return left - right;
}