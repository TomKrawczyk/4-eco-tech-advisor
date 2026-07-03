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

function hasMeaningfulValue(value) {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.some(hasMeaningfulValue);
  if (typeof value === 'object') return Object.values(value).some(hasMeaningfulValue);
  return true;
}

function hasMeaningfulInterviewData(interviewData) {
  return !!interviewData && typeof interviewData === 'object' && Object.values(interviewData).some(hasMeaningfulValue);
}

function hasMeaningfulComments(comments) {
  return String(comments || '').trim().length > 2;
}

function buildMeetingReportsIndex(reports) {
  return reports.map((report) => ({
    id: report.id,
    email: getReportAuthorEmail(report),
    date: localYMD(report.meeting_date || report.visit_date || report.created_date),
    client_name: normalizeName(report.client_name),
    client_phone: last9(report.client_phone || report.phone),
  }));
}

function buildPhoneReportsIndex(reports) {
  return reports.map((report) => ({
    id: report.id,
    email: getReportAuthorEmail(report),
    date: localYMD(report.contact_date || report.created_date),
    client_name: normalizeName(report.client_name),
    client_phone: last9(report.client_phone || report.phone),
    contact_key: String(report.contact_key || '').trim(),
  }));
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

function dateMatches(recordDate, reportDate) {
  if (!recordDate || !reportDate) return true;
  return reportDate === recordDate || reportDate >= recordDate;
}

function emailMatches(record, indexedReport) {
  const recordEmail = normalizeEmail(record.assigned_user_email || record.author_email || record.owner_email);
  return !recordEmail || !indexedReport.email || indexedReport.email === recordEmail;
}

function hasInlineMeetingReportEvidence(record) {
  return hasMeaningfulInterviewData(record.interview_data) || hasMeaningfulComments(record.comments);
}

function hasInlinePhoneReportEvidence(record) {
  return hasMeaningfulInterviewData(record.interview_data) || hasMeaningfulComments(record.comments);
}

function hasSeparateMeetingReport(record, reportsIndex) {
  const meetingDate = getMeetingDate(record);
  return reportsIndex.some((report) => emailMatches(record, report) && clientMatches(record, report) && dateMatches(meetingDate, report.date));
}

function hasSeparatePhoneReport(record, reportsIndex) {
  const contactKey = String(record.contact_key || '').trim();
  const contactDate = getContactDate(record);
  return reportsIndex.some((report) => {
    const contactKeyMatch = contactKey && report.contact_key && contactKey === report.contact_key;
    const clientMatch = clientMatches(record, report);
    return emailMatches(record, report) && (contactKeyMatch || clientMatch) && dateMatches(contactDate, report.date);
  });
}

function hasReportForMeeting(record, reportsIndex) {
  return hasInlineMeetingReportEvidence(record) || hasSeparateMeetingReport(record, reportsIndex);
}

function hasReportForPhoneContact(record, reportsIndex) {
  return hasInlinePhoneReportEvidence(record) || hasSeparatePhoneReport(record, reportsIndex);
}

function createMeetingKey(record) {
  return `${record.sheet}__${record.client_name}__${record.meeting_calendar}`;
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

    const [users, allowedUsers, meetingAssignments, meetingReports, visitReports, phoneContacts, phoneContactReports, calendarEvents, meetingsCacheRows] = await Promise.all([
      fetchAll(svc.User),
      fetchAll(svc.AllowedUser),
      fetchAll(svc.MeetingAssignment),
      fetchAll(svc.MeetingReport),
      fetchAll(svc.VisitReport),
      fetchAll(svc.PhoneContact),
      fetchAll(svc.PhoneContactReport),
      fetchAll(svc.CalendarEvent),
      svc.MeetingsCache.filter({ cache_key: 'meetings_main' }, '-updated_date', 1),
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

    const meetingReportsIndex = buildMeetingReportsIndex(
      [...meetingReports, ...visitReports].filter((report) => monitoredEmails.has(getReportAuthorEmail(report)))
    );
    const phoneReportsIndex = buildPhoneReportsIndex(
      phoneContactReports.filter((report) => monitoredEmails.has(getReportAuthorEmail(report)))
    );

    const cacheRecord = meetingsCacheRows[0]?.data || meetingsCacheRows[0] || null;
    const cachedMeetings = cacheRecord?.meetings_json?.meetings || [];
    const cachedMeetingsByKey = new Map(
      cachedMeetings.map((meeting) => [createMeetingKey(meeting), meeting])
    );

    const overdueByEmail = new Map();

    const postponedMeetingKeys = new Set();
    for (const event of calendarEvents) {
      if (event.status !== 'postponed' || !event.postponed_to) continue;
      const postponedTo = parseYMD(event.postponed_to);
      if (!postponedTo || postponedTo <= today) continue;
      const email = normalizeEmail(event.owner_email);
      const phoneKey = last9(event.client_phone || event.phone);
      const nameKey = normalizeName(event.client_name);
      const clientKey = phoneKey || nameKey;
      if (!email || !clientKey) continue;
      postponedMeetingKeys.add(`${email}|${clientKey}`);
    }

    const latestMeetingByUserClient = new Map();
    for (const assignment of meetingAssignments) {
      const email = normalizeEmail(assignment.assigned_user_email);
      const meetingDate = getMeetingDate(assignment);
      const phoneKey = last9(assignment.client_phone || assignment.phone);
      const nameKey = normalizeName(assignment.client_name);
      const clientKey = phoneKey || nameKey;
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

      const cachedMeeting = cachedMeetingsByKey.get(assignment.meeting_key) || {};
      const mergedMeeting = {
        ...cachedMeeting,
        ...assignment,
        client_name: assignment.client_name || cachedMeeting.client_name || '',
        client_phone: assignment.client_phone || cachedMeeting.phone || cachedMeeting.client_phone || '',
        comments: cachedMeeting.comments || assignment.comments || '',
        interview_data: cachedMeeting.interview_data || assignment.interview_data || {},
        meeting_calendar: assignment.meeting_calendar || cachedMeeting.meeting_calendar || '',
        meeting_date: assignment.meeting_date || getMeetingDate(cachedMeeting) || '',
        meeting_note: cachedMeeting.meeting_note || assignment.meeting_note || '',
        status: cachedMeeting.status || assignment.status || '',
        assigned_user_email: assignment.assigned_user_email,
      };

      if (hasReportForMeeting(mergedMeeting, meetingReportsIndex)) continue;

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
      const phoneKey = last9(contact.client_phone || contact.phone);
      const nameKey = normalizeName(contact.client_name);
      const clientKey = phoneKey || nameKey;
      if (!clientKey) continue;

      if (hasReportForPhoneContact(contact, phoneReportsIndex)) continue;

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

      if (shouldBeBlocked) stillBlockedCount += 1;

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