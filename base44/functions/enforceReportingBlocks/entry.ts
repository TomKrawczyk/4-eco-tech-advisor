import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const TRACKED_ROLES = new Set(['advisor', 'team_leader', 'group_leader']);
const REPORTING_WINDOW_DAYS = 45;
const MAX_ALLOWED_BUSINESS_DAYS = 3;
const GRACE_START_DATE = '2026-06-16';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeName(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizePhone(value) {
  return pickFirstPhone(value).replace(/\D/g, '');
}

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

function parseYMD(value) {
  const ymd = localYMD(value);
  if (!ymd) return null;
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function getContactDate(record) {
  return record.contact_date || localYMD(record.contact_calendar) || localYMD(record.date) || localYMD(record.created_date) || '';
}

function getMeetingDate(record) {
  return record.meeting_date || localYMD(record.meeting_calendar) || '';
}

function getClientKey(record) {
  const phone = last9(record.client_phone || record.phone);
  if (phone.length >= 7) return phone;
  return normalizeName(record.client_name);
}

function getBusinessDaysElapsed(startValue, endDate) {
  const start = parseYMD(startValue);
  if (!start) return 0;
  const cursor = new Date(start);
  cursor.setDate(cursor.getDate() + 1);
  let count = 0;
  while (cursor <= endDate) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

async function fetchAll(entity) {
  const rows = [];
  let skip = 0;
  const limit = 500;
  while (true) {
    const batch = await entity.list('-created_date', limit, skip);
    if (!batch || batch.length === 0) break;
    rows.push(...batch);
    if (batch.length < limit) break;
    skip += limit;
    if (skip > 50000) break;
  }
  return rows;
}

function getReportAuthorEmail(report) {
  return normalizeEmail(report.author_email || report.created_by || report.email);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const requestedDryRun = body?.dry_run === true;
    const dryRun = requestedDryRun || body?.dryRun === true;
    const svc = base44.asServiceRole.entities;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nowIso = new Date().toISOString();
    const windowStart = new Date(today);
    windowStart.setDate(windowStart.getDate() - REPORTING_WINDOW_DAYS);
    const windowStartYmd = localYMD(windowStart);
    const effectiveStartYmd = GRACE_START_DATE > windowStartYmd ? GRACE_START_DATE : windowStartYmd;

    const [users, allowedUsers, meetingAssignments, meetingReports, visitReports, phoneContacts, phoneContactReports, calendarEvents] = await Promise.all([
      fetchAll(svc.User),
      fetchAll(svc.AllowedUser),
      fetchAll(svc.MeetingAssignment),
      fetchAll(svc.MeetingReport),
      fetchAll(svc.VisitReport),
      fetchAll(svc.PhoneContact),
      fetchAll(svc.PhoneContactReport),
      fetchAll(svc.CalendarEvent),
    ]);
    const allowedByEmail = new Map();
    for (const record of allowedUsers) {
      const email = normalizeEmail(record.email || record.data?.email);
      if (!email) continue;
      allowedByEmail.set(email, record);
    }

    const trackedUsers = users
      .map((user) => {
        const email = normalizeEmail(user.email);
        const allowed = allowedByEmail.get(email);
        const fieldRole = allowed?.role || allowed?.data?.role || user.role;
        return {
          ...user,
          email,
          fieldRole,
          allowed,
          isExempt: (allowed?.exempt_from_reports || allowed?.data?.exempt_from_reports) === true,
        };
      })
      .filter((user) =>
        TRACKED_ROLES.has(user.fieldRole) ||
        user.account_status === 'blocked' ||
        user.allowed?.is_blocked === true ||
        user.allowed?.data?.is_blocked === true
      );

    const monitoredEmails = new Set(
      trackedUsers
        .filter((user) => TRACKED_ROLES.has(user.fieldRole) && !user.isExempt)
        .map((user) => user.email)
    );

    const meetingReportKeys = new Set();
    const meetingReportTimeline = new Map();
    for (const report of [...meetingReports, ...visitReports]) {
      const email = getReportAuthorEmail(report);
      if (!monitoredEmails.has(email)) continue;
      const reportDate = localYMD(report.meeting_date || report.visit_date || report.created_date);
      const createdDate = localYMD(report.created_date);
      const clientKey = getClientKey(report);
      if (!clientKey) continue;
      const timelineKey = `${email}|${clientKey}`;
      if (!meetingReportTimeline.has(timelineKey)) meetingReportTimeline.set(timelineKey, []);
      meetingReportTimeline.get(timelineKey).push({ reportDate, createdDate });
      if (reportDate) meetingReportKeys.add(`${email}|${reportDate}|${clientKey}`);
    }

    const phoneReportKeys = new Set();
    const phoneReportContactKeys = new Set();
    const phoneReportTimeline = new Map();
    for (const report of phoneContactReports) {
      const email = getReportAuthorEmail(report);
      if (!monitoredEmails.has(email)) continue;
      if (report.contact_key) phoneReportContactKeys.add(`${email}|${report.contact_key}`);
      const reportDate = localYMD(report.contact_date || report.created_date);
      const createdDate = localYMD(report.created_date);
      const clientKey = getClientKey(report);
      if (!clientKey) continue;
      const timelineKey = `${email}|${clientKey}`;
      if (!phoneReportTimeline.has(timelineKey)) phoneReportTimeline.set(timelineKey, []);
      phoneReportTimeline.get(timelineKey).push({ reportDate, createdDate });
      if (reportDate) phoneReportKeys.add(`${email}|${reportDate}|${clientKey}`);
    }

    const overdueByEmail = new Map();

    const postponedMeetingKeys = new Set();
    for (const event of calendarEvents) {
      if (event.status !== 'postponed' || !event.postponed_to) continue;
      const postponedTo = parseYMD(event.postponed_to);
      if (!postponedTo || postponedTo <= today) continue;
      const email = normalizeEmail(event.owner_email);
      const clientKey = getClientKey(event);
      if (!email || !clientKey) continue;
      postponedMeetingKeys.add(`${email}|${clientKey}`);
    }

    const latestMeetingByUserClient = new Map();
    for (const assignment of meetingAssignments) {
      const email = normalizeEmail(assignment.assigned_user_email);
      const meetingDate = getMeetingDate(assignment);
      const clientKey = getClientKey(assignment);
      if (!email || !meetingDate || !clientKey) continue;
      const dedupeKey = `${email}|${clientKey}`;
      const existing = latestMeetingByUserClient.get(dedupeKey);
      if (!existing || meetingDate > existing.meetingDate) {
        latestMeetingByUserClient.set(dedupeKey, { assignment, meetingDate, clientKey });
      }
    }

    for (const { assignment, meetingDate, clientKey } of latestMeetingByUserClient.values()) {
      const email = normalizeEmail(assignment.assigned_user_email);
      if (!monitoredEmails.has(email) || meetingDate < effectiveStartYmd) continue;
      if (postponedMeetingKeys.has(`${email}|${clientKey}`)) continue;
      const reportKey = `${email}|${meetingDate}|${clientKey}`;
      const matchingReports = meetingReportTimeline.get(`${email}|${clientKey}`) || [];
      const hasMatchingReport = meetingReportKeys.has(reportKey) || matchingReports.some((report) => {
        return (report.reportDate && report.reportDate >= meetingDate) || (report.createdDate && report.createdDate >= meetingDate);
      });
      if (hasMatchingReport) continue;
      const businessDays = getBusinessDaysElapsed(meetingDate, today);
      if (businessDays <= MAX_ALLOWED_BUSINESS_DAYS) continue;
      if (!overdueByEmail.has(email)) overdueByEmail.set(email, []);
      overdueByEmail.get(email).push({
        type: 'meeting',
        date: meetingDate,
        businessDays,
        client_name: assignment.client_name || 'Klient',
        reason: `Brak raportu po spotkaniu: ${assignment.client_name || 'Klient'} (${meetingDate})`,
      });
    }

    for (const contact of phoneContacts) {
      const email = normalizeEmail(contact.assigned_user_email);
      const contactDate = getContactDate(contact);
      if (!monitoredEmails.has(email) || !contactDate || contactDate < effectiveStartYmd) continue;
      const clientKey = getClientKey(contact);
      if (!clientKey) continue;
      const hasDirectReport = contact.contact_key && phoneReportContactKeys.has(`${email}|${contact.contact_key}`);
      const matchingReports = phoneReportTimeline.get(`${email}|${clientKey}`) || [];
      const hasFallbackReport = phoneReportKeys.has(`${email}|${contactDate}|${clientKey}`) || matchingReports.some((report) => {
        return (report.reportDate && report.reportDate >= contactDate) || (report.createdDate && report.createdDate >= contactDate);
      });
      if (hasDirectReport || hasFallbackReport) continue;
      const businessDays = getBusinessDaysElapsed(contactDate, today);
      if (businessDays <= MAX_ALLOWED_BUSINESS_DAYS) continue;
      if (!overdueByEmail.has(email)) overdueByEmail.set(email, []);
      overdueByEmail.get(email).push({
        type: 'phone_contact',
        date: contactDate,
        businessDays,
        client_name: contact.client_name || 'Klient',
        reason: `Brak raportu po kontakcie telefonicznym: ${contact.client_name || 'Klient'} (${contactDate})`,
      });
    }

    const newlyBlocked = [];
    const unblocked = [];
    let stillBlockedCount = 0;

    for (const user of trackedUsers) {
      const currentStatus = user.account_status === 'blocked' || user.allowed?.is_blocked === true || user.allowed?.data?.is_blocked === true ? 'blocked' : 'active';
      const overdue = (overdueByEmail.get(user.email) || []).sort((a, b) => String(a.date).localeCompare(String(b.date)));
      const oldest = overdue[0] || null;
      const shouldBeBlocked = !!oldest;

      if (shouldBeBlocked) {
        stillBlockedCount += 1;
      }

      const allowedUpdates = user.allowed ? {
        is_blocked: shouldBeBlocked,
        blocked_reason: shouldBeBlocked ? oldest.reason : '',
        missing_reports_count: overdue.length,
      } : null;

      if (shouldBeBlocked && currentStatus !== 'blocked') {
        newlyBlocked.push({
          name: user.full_name || user.allowed?.name || user.allowed?.data?.name || user.email,
          email: user.email,
          reason: oldest.reason,
        });
        if (!dryRun) {
          await svc.User.update(user.id, {
            account_status: 'blocked',
            blocked_reason: oldest.reason,
            blocked_at: nowIso,
          });
          if (user.allowed && allowedUpdates) {
            await svc.AllowedUser.update(user.allowed.id, allowedUpdates);
          }
        }
      } else if (!shouldBeBlocked && currentStatus === 'blocked') {
        unblocked.push({
          name: user.full_name || user.allowed?.name || user.allowed?.data?.name || user.email,
          email: user.email,
        });
        if (!dryRun) {
          await svc.User.update(user.id, {
            account_status: 'active',
            blocked_reason: '',
            blocked_at: '',
          });
          if (user.allowed && allowedUpdates) {
            await svc.AllowedUser.update(user.allowed.id, allowedUpdates);
          }
        }
      } else if (!dryRun && user.allowed && allowedUpdates) {
        await svc.AllowedUser.update(user.allowed.id, allowedUpdates);
      }
    }

    return Response.json({
      checked: trackedUsers.length,
      newly_blocked: newlyBlocked,
      unblocked,
      still_blocked_count: stillBlockedCount,
      dry_run: requestedDryRun,
      grace_start_date: GRACE_START_DATE,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});