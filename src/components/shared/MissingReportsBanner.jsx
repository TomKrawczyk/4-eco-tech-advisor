import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, X, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { startOfDay } from "date-fns";
import { buildMeetingReportsIndex, hasReportForMeeting, normalizeName, normalizePhoneLast9 } from "@/lib/reportingStatus";

const GRACE_START_DATE = "2026-06-16";

function getBusinessDaysElapsed(startDate, endDate) {
  const cursor = new Date(startDate);
  cursor.setDate(cursor.getDate() + 1);
  let count = 0;
  while (cursor <= endDate) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

function parseMeetingDate(str) {
  if (!str) return null;
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
  const plMatch = str.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (plMatch) return new Date(parseInt(plMatch[3]), parseInt(plMatch[2]) - 1, parseInt(plMatch[1]));
  return null;
}

export default function MissingReportsBanner({ currentUser }) {
  const [missingMeetings, setMissingMeetings] = useState([]);
  const [dismissed, setDismissed] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    if (!currentUser?.email) return;

    const check = async () => {
      const today = startOfDay(new Date());

      const [assignments, reports, visitReports, allowedUsers, calendarEvents, cacheRows] = await Promise.all([
        base44.entities.MeetingAssignment.filter({ assigned_user_email: currentUser.email }),
        base44.entities.MeetingReport.filter({ author_email: currentUser.email }),
        base44.entities.VisitReport.filter({ author_email: currentUser.email }),
        base44.entities.AllowedUser.list(),
        base44.entities.CalendarEvent.filter({ owner_email: currentUser.email }),
        base44.entities.MeetingsCache.filter({ cache_key: "meetings_main" }, "-updated_date", 1),
      ]);

      const ua = allowedUsers.find((u) => (u.data?.email || u.email) === currentUser.email);
      const isExempt = ua?.data?.exempt_from_reports || ua?.exempt_from_reports || false;
      if (isExempt) return;
      setIsBlocked(ua?.data?.is_blocked || ua?.is_blocked || false);

      const cacheRecord = cacheRows[0]?.data || cacheRows[0] || null;
      const cachedMeetings = cacheRecord?.meetings_json?.meetings || [];
      const cachedByKey = new Map(
        cachedMeetings.map((meeting) => [`${meeting.sheet}__${meeting.client_name}__${meeting.meeting_calendar}`, meeting])
      );
      const reportsIndex = buildMeetingReportsIndex([...reports, ...visitReports]);

      const postponedClientKeys = new Set();
      for (const ev of calendarEvents) {
        if (ev.status !== "postponed" || !ev.postponed_to) continue;
        const newDay = parseMeetingDate(ev.postponed_to);
        if (!newDay || startOfDay(newDay) <= today) continue;
        const key = normalizePhoneLast9(ev.client_phone) || normalizeName(ev.client_name);
        if (key) postponedClientKeys.add(key);
      }

      const deduped = new Map();
      for (const assignment of assignments) {
        const cachedMeeting = cachedByKey.get(assignment.meeting_key) || {};
        const mergedMeeting = {
          ...cachedMeeting,
          ...assignment,
          client_name: assignment.client_name || cachedMeeting.client_name || "",
          client_phone: assignment.client_phone || cachedMeeting.phone || cachedMeeting.client_phone || "",
          comments: cachedMeeting.comments || assignment.comments || "",
          interview_data: cachedMeeting.interview_data || assignment.interview_data || {},
          meeting_calendar: assignment.meeting_calendar || cachedMeeting.meeting_calendar || "",
          meeting_date: assignment.meeting_date || cachedMeeting.meeting_date || "",
          meeting_note: cachedMeeting.meeting_note || assignment.meeting_note || "",
          status: cachedMeeting.status || assignment.status || "",
          assigned_user_email: currentUser.email,
        };

        const meetingDay = parseMeetingDate(mergedMeeting.meeting_calendar || mergedMeeting.meeting_date);
        if (!meetingDay) continue;
        const keyId = normalizePhoneLast9(mergedMeeting.client_phone) || normalizeName(mergedMeeting.client_name);
        if (!keyId) continue;
        const existing = deduped.get(keyId);
        const existingDay = existing ? parseMeetingDate(existing.meeting_calendar || existing.meeting_date) : null;
        if (!existing || (meetingDay && existingDay && meetingDay > existingDay)) {
          deduped.set(keyId, mergedMeeting);
        }
      }

      const missing = Array.from(deduped.values()).filter((meeting) => {
        const meetingDay = parseMeetingDate(meeting.meeting_calendar || meeting.meeting_date);
        if (!meetingDay) return false;
        const day = startOfDay(meetingDay);
        if (day >= today) return false;
        if ((meeting.meeting_date || "") < GRACE_START_DATE) return false;
        const businessDays = getBusinessDaysElapsed(day, today);
        if (businessDays <= 3) return false;
        const clientKey = normalizePhoneLast9(meeting.client_phone) || normalizeName(meeting.client_name);
        if (clientKey && postponedClientKeys.has(clientKey)) return false;
        return !hasReportForMeeting(meeting, reportsIndex);
      });

      setMissingMeetings(missing);
    };

    const handleAccessRefresh = () => {
      check();
    };

    check();
    window.addEventListener('user-access-updated', handleAccessRefresh);

    return () => {
      window.removeEventListener('user-access-updated', handleAccessRefresh);
    };
  }, [currentUser?.email, currentUser?.is_blocked]);

  if (isBlocked) {
    return (
      <div className="bg-red-600 text-white px-4 py-3 text-sm flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <div className="flex-1">
          <span className="font-bold">KONTO ZABLOKOWANE – </span>
          <span>Masz niezłożone raporty po spotkaniach. Złóż raporty aby odblokować dostęp do funkcji aplikacji.</span>
        </div>
        <button
          onClick={() => window.scrollTo({ top: 200, behavior: "smooth" })}
          className="shrink-0 bg-white text-red-600 font-semibold px-3 py-1 rounded-lg text-xs hover:bg-red-50 transition-colors"
        >
          Złóż raport
        </button>
      </div>
    );
  }

  if (dismissed || missingMeetings.length === 0) return null;

  return (
    <div className="bg-orange-500 text-white px-4 py-3 text-sm flex items-center gap-3">
      <AlertTriangle className="w-5 h-5 shrink-0" />
      <div className="flex-1">
        <span className="font-semibold">Brak raportów po spotkaniach! </span>
        <span>
          Masz {missingMeetings.length} {missingMeetings.length === 1 ? "spotkanie" : "spotkań"} bez raportu po ponad 3 dniach roboczych.
        </span>
      </div>
      <Link
        to={createPageUrl("MeetingReports")}
        className="shrink-0 bg-white text-orange-600 font-semibold px-3 py-1 rounded-lg text-xs hover:bg-orange-50 transition-colors flex items-center gap-1"
      >
        <FileText className="w-3 h-3" />
        Raportuj
      </Link>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 p-1 hover:bg-orange-400 rounded transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}