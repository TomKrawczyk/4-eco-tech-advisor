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

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeName(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeKey(value) {
  return String(value || '').trim();
}

function dateMatches(recordDate, reportDate) {
  if (!recordDate || !reportDate) return true;
  return reportDate === recordDate || reportDate >= recordDate;
}

function clientMatches(record, indexedReport) {
  const recordPhone = last9(record.client_phone || record.phone);
  const reportPhone = indexedReport.client_phone;
  if (recordPhone && reportPhone) return recordPhone === reportPhone;

  const recordName = normalizeName(record.client_name);
  const reportName = indexedReport.client_name;
  if (!recordName || !reportName) return false;
  return recordName === reportName || recordName.startsWith(reportName) || reportName.startsWith(recordName);
}

function emailMatches(record, indexedReport) {
  const recordEmail = normalizeEmail(record.assigned_user_email || record.author_email || record.owner_email);
  return !recordEmail || !indexedReport.email || indexedReport.email === recordEmail;
}

function buildMeetingReportsIndex(reports) {
  return reports.map((report) => ({
    id: report.id,
    email: normalizeEmail(report.author_email || report.created_by || report.email),
    date: localYMD(report.meeting_date || report.visit_date || report.created_date),
    client_name: normalizeName(report.client_name),
    client_phone: last9(report.client_phone || report.phone),
    status: normalizeKey(report.status).toLowerCase() || 'reported',
  }));
}

function buildPhoneReportsIndex(reports) {
  return reports.map((report) => ({
    id: report.id,
    email: normalizeEmail(report.author_email || report.created_by || report.email),
    date: localYMD(report.contact_date || report.created_date),
    client_name: normalizeName(report.client_name),
    client_phone: last9(report.client_phone || report.phone),
    contact_key: normalizeKey(report.contact_key),
    status: normalizeKey(report.result).toLowerCase() || 'reported',
  }));
}

function findMeetingReport(record, reportsIndex) {
  const recordDate = record.meeting_date || localYMD(record.meeting_calendar) || '';
  return reportsIndex.find((report) => emailMatches(record, report) && clientMatches(record, report) && dateMatches(recordDate, report.date));
}

function findPhoneReport(record, reportsIndex) {
  const contactKey = normalizeKey(record.contact_key);
  const recordDate = getContactDate(record);
  return reportsIndex.find((report) => {
    const contactKeyMatch = contactKey && report.contact_key && contactKey === report.contact_key;
    return emailMatches(record, report) && (contactKeyMatch || clientMatches(record, report)) && dateMatches(recordDate, report.date);
  });
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
    const [allowedUsers, groups, meetingAssignments, meetingReports, visitReports, phoneContacts, phoneReports] = await Promise.all([
      fetchAll(svc.AllowedUser),
      fetchAll(svc.Group),
      fetchAll(svc.MeetingAssignment),
      fetchAll(svc.MeetingReport),
      fetchAll(svc.VisitReport),
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

    const grpOfAssign = (record) => {
      return (record.assigned_group_name || (record.assigned_group_id ? groupNameById[record.assigned_group_id] : '') || '').trim() || 'Bez struktury';
    };

    const grpOfReport = (record) => {
      const email = (record.author_email || '').trim().toLowerCase();
      return email && emailToGroup[email] ? emailToGroup[email] : 'Bez struktury';
    };

    const meetingReportsIndex = buildMeetingReportsIndex([...meetingReports, ...visitReports]);
    const phoneReportsIndex = buildPhoneReportsIndex(phoneReports);

    const structuresMap = {};
    const getStructure = (name) => {
      if (!structuresMap[name]) {
        structuresMap[name] = {
          name,
          meeting_reports: 0,
          reports_completed: 0,
          reports_planned: 0,
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
      const structureName = grpOfAssign(assignment);
      const structure = getStructure(structureName);
      const advisorEmail = (assignment.assigned_user_email || '').trim().toLowerCase();
      const peopleKey = advisorEmail || '__nieprzypisany__';
      structure.people[peopleKey] = (structure.people[peopleKey] || 0) + 1;
      const matchedReport = findMeetingReport(assignment, meetingReportsIndex);
      const reportStatus = matchedReport?.status || null;
      structure.clients.push({
        client_name: assignment.client_name || '—',
        client_phone: assignment.client_phone || '',
        client_address: assignment.client_address || '',
        meeting_date: assignment.meeting_date || '',
        meeting_calendar: assignment.meeting_calendar || assignment.meeting_date || '',
        advisor_name: assignment.assigned_user_name || (advisorEmail ? (emailToName[advisorEmail] || advisorEmail) : '— nieprzypisany —'),
        advisor_email: advisorEmail || null,
        report_author_email: matchedReport?.email || null,
        reported: !!matchedReport,
        report_status: reportStatus,
      });
    }

    for (const contact of phoneContacts) {
      const contactDate = getContactDate(contact);
      if (!inRange(contactDate) || contact.is_archived === true) continue;
      const structureName = grpOfAssign(contact);
      const structure = getStructure(structureName);
      const advisorEmail = (contact.assigned_user_email || '').trim().toLowerCase();
      const matchedReport = findPhoneReport(contact, phoneReportsIndex);
      const reported = !!matchedReport;
      const reportStatus = matchedReport?.status || null;

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
      const meetingsAssigned = structure.clients.length;
      const reportedClients = structure.clients.filter((client) => client.reported);
      const meetingReportsCount = reportedClients.length;
      const reportsCompleted = reportedClients.filter((client) => client.report_status === 'completed' || client.report_status === 'sent').length;
      const reportsPlanned = reportedClients.filter((client) => client.report_status === 'planned').length;
      const phoneContactsAssigned = structure.phone_contacts.length;
      const phoneContactsReported = structure.phone_contacts.filter((contact) => contact.reported).length;
      const phoneContactsMissing = Math.max(0, phoneContactsAssigned - phoneContactsReported);
      const meetingCoverage = meetingsAssigned > 0
        ? Math.round((meetingReportsCount / meetingsAssigned) * 100)
        : null;
      const phoneCoverage = phoneContactsAssigned > 0
        ? Math.round((phoneContactsReported / phoneContactsAssigned) * 100)
        : null;
      const meetingReporters = reportedClients.reduce((acc, client) => {
        const email = client.report_author_email || client.advisor_email || '__nieznany__';
        acc[email] = (acc[email] || 0) + 1;
        return acc;
      }, {});

      return {
        name: structure.name,
        metrics: {
          meetings_assigned: meetingsAssigned,
          meeting_reports: meetingReportsCount,
          reports_completed: reportsCompleted,
          reports_planned: reportsPlanned,
          report_coverage_pct: meetingCoverage,
          missing_reports: meetingsAssigned > 0 ? Math.max(0, meetingsAssigned - meetingReportsCount) : 0,
          phone_contacts_assigned: phoneContactsAssigned,
          phone_contacts_reported: phoneContactsReported,
          phone_contacts_coverage_pct: phoneCoverage,
          phone_contacts_missing: phoneContactsMissing,
          phone_assigned: phoneContactsAssigned,
          phone_reported: phoneContactsReported,
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
        reporters: Object.entries(meetingReporters)
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
          return String(a.contact_date || a.contact_calendar).localeCompare(String(b.contact_date || b.contact_calendar));
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