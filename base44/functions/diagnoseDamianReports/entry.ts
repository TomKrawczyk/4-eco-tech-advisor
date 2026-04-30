import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const TARGET_EMAIL = 'damian.olszewski@4-eco.pl';

function parseDate(str) {
  if (!str) return null;
  const isoMatch = String(str).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
  const plMatch = String(str).match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (plMatch) return new Date(parseInt(plMatch[3]), parseInt(plMatch[2]) - 1, parseInt(plMatch[1]));
  return null;
}

const normalizePhone = (p) => (p || '').replace(/\s+/g, '').replace(/[^\d]/g, '');
const normalizeStr = (s) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ').replace(/\s*-\s*/g, '-');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const requester = await base44.auth.me();
    if (!requester) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date();
    const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const [allowedUsers, groups, assignments, meetingReports, visitReports, calendarEvents, phoneContacts, phoneContactReports] = await Promise.all([
      base44.asServiceRole.entities.AllowedUser.list(),
      base44.asServiceRole.entities.Group.list(),
      base44.asServiceRole.entities.MeetingAssignment.list(),
      base44.asServiceRole.entities.MeetingReport.list(),
      base44.asServiceRole.entities.VisitReport.list(),
      base44.asServiceRole.entities.CalendarEvent.list(),
      base44.asServiceRole.entities.PhoneContact.list(),
      base44.asServiceRole.entities.PhoneContactReport.list(),
    ]);

    const user = allowedUsers.find((u) => (u.email || u.data?.email) === TARGET_EMAIL);
    if (!user) {
      return Response.json({ error: 'Nie znaleziono Damiana Olszewskiego w AllowedUser' }, { status: 404 });
    }

    const postponedKeys = new Set();
    for (const ev of calendarEvents) {
      if (ev.status !== 'postponed' || !ev.postponed_to) continue;
      const newDay = parseDate(ev.postponed_to);
      if (!newDay || newDay <= todayDay) continue;
      const phone = normalizePhone(ev.client_phone);
      const name = normalizeStr(ev.client_name);
      const clientKey = phone.length >= 7 ? phone : name;
      if (clientKey && ev.owner_email) postponedKeys.add(`${ev.owner_email}|${clientKey}`);
    }

    const latestAssignments = new Map();
    for (const assignment of assignments) {
      if (assignment.assigned_user_email !== TARGET_EMAIL) continue;
      const phone = normalizePhone(assignment.client_phone);
      const name = normalizeStr(assignment.client_name);
      const clientKey = phone.length >= 7 ? phone : name;
      if (!clientKey) continue;
      const key = `${assignment.assigned_user_email}|${clientKey}`;
      const existing = latestAssignments.get(key);
      const thisDate = parseDate(assignment.meeting_date);
      const existingDate = existing ? parseDate(existing.meeting_date) : null;
      if (!existing || (thisDate && existingDate && thisDate > existingDate)) {
        latestAssignments.set(key, assignment);
      }
    }

    const allMeetingProofs = [...meetingReports, ...visitReports];
    const missingMeetingReports = [];
    for (const assignment of latestAssignments.values()) {
      const meetingDay = parseDate(assignment.meeting_date);
      if (!meetingDay) continue;
      const daysLate = Math.floor((todayDay - meetingDay) / 86400000);
      if (daysLate <= 0) continue;

      const aPhone = normalizePhone(assignment.client_phone);
      const aName = normalizeStr(assignment.client_name);
      const clientKey = aPhone.length >= 7 ? aPhone : aName;
      if (postponedKeys.has(`${TARGET_EMAIL}|${clientKey}`)) continue;

      const hasReport = allMeetingProofs.some((report) => {
        if (report.author_email !== TARGET_EMAIL) return false;
        const rPhone = normalizePhone(report.client_phone);
        const rName = normalizeStr(report.client_name);
        const phoneMatch = aPhone.length >= 7 && rPhone.length >= 7 && aPhone === rPhone;
        const nameMatch = rName === aName || (rName.length > 2 && aName.startsWith(rName)) || (aName.length > 2 && rName.startsWith(aName));
        return phoneMatch || nameMatch;
      });

      if (!hasReport) {
        missingMeetingReports.push({
          client_name: assignment.client_name,
          client_phone: assignment.client_phone || '',
          meeting_date: assignment.meeting_date,
          days_late: daysLate,
          source: 'spotkanie',
        });
      }
    }

    const hasPhoneReport = (contact) => {
      const cPhone = normalizePhone(contact.phone || contact.client_phone);
      const cName = normalizeStr(contact.client_name);
      return phoneContactReports.some((report) => {
        const rPhone = normalizePhone(report.client_phone);
        const rName = normalizeStr(report.client_name);
        const phoneMatch = cPhone.length >= 7 && rPhone.length >= 7 && cPhone === rPhone;
        const nameMatch = rName === cName || (rName.length > 2 && cName.startsWith(rName)) || (cName.length > 2 && rName.startsWith(cName));
        return phoneMatch || nameMatch;
      });
    };

    const leaderGroups = groups.filter((group) => {
      const leaderIds = group.group_leader_ids || (group.group_leader_id ? [group.group_leader_id] : []);
      return leaderIds.includes(user.id);
    });
    const leaderGroupIds = new Set(leaderGroups.map((group) => group.id));

    const phoneCandidates = phoneContacts.filter((contact) =>
      contact.assigned_user_email === TARGET_EMAIL ||
      (contact.assigned_group_id && !contact.assigned_user_email && leaderGroupIds.has(contact.assigned_group_id))
    );

    const missingPhoneReports = [];
    for (const contact of phoneCandidates) {
      if (hasPhoneReport(contact)) continue;
      const assignedDate = contact.updated_date || contact.created_date;
      const assignedDay = assignedDate ? new Date(assignedDate) : todayDay;
      const normalizedAssignedDay = new Date(assignedDay.getFullYear(), assignedDay.getMonth(), assignedDay.getDate());
      const daysLate = Math.floor((todayDay - normalizedAssignedDay) / 86400000);
      if (daysLate < 3) continue;
      missingPhoneReports.push({
        client_name: contact.client_name,
        client_phone: contact.phone || contact.client_phone || '',
        assigned_group_name: contact.assigned_group_name || '',
        assigned_user_email: contact.assigned_user_email || '',
        days_since_assignment: daysLate,
        source: contact.assigned_user_email === TARGET_EMAIL ? 'kontakt przypisany do użytkownika' : 'kontakt grupowy',
      });
    }

    return Response.json({
      user: {
        name: user.name || user.data?.name,
        email: TARGET_EMAIL,
        role: user.role || user.data?.role,
        is_blocked: user.is_blocked || user.data?.is_blocked || false,
        blocked_reason: user.blocked_reason || user.data?.blocked_reason || '',
        missing_reports_count: user.missing_reports_count || user.data?.missing_reports_count || 0,
      },
      missingMeetingReports,
      missingPhoneReports,
      summary: {
        missing_meeting_reports_count: missingMeetingReports.length,
        missing_phone_reports_count: missingPhoneReports.length,
        total_missing_count: missingMeetingReports.length + missingPhoneReports.length,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});