import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { startOfDay } from "date-fns";
import {
  buildMeetingReportsIndex,
  hasReportForMeeting,
  normalizeName,
  normalizePhoneLast9,
} from "@/lib/reportingStatus";

const GRACE_START_DATE = "2026-06-16";
const MAX_ALLOWED_BUSINESS_DAYS = 3;

function parseMeetingDate(str) {
  if (!str) return null;
  const s = String(str);
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return new Date(+isoMatch[1], +isoMatch[2] - 1, +isoMatch[3]);
  const plMatch = s.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (plMatch) return new Date(+plMatch[3], +plMatch[2] - 1, +plMatch[1]);
  return null;
}

function localYMD(str) {
  if (!str) return "";
  const m = String(str).match(/\d{4}-\d{2}-\d{2}/);
  if (m) return m[0];
  const pl = String(str).match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
  if (pl) return `${pl[3]}-${pl[2].padStart(2, "0")}-${pl[1].padStart(2, "0")}`;
  return "";
}

function getBusinessDaysElapsed(start, end) {
  const cursor = new Date(start);
  cursor.setDate(cursor.getDate() + 1);
  let n = 0;
  while (cursor <= end) {
    const d = cursor.getDay();
    if (d !== 0 && d !== 6) n += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return n;
}

// Zwraca listy zaległych raportów po spotkaniach i kontaktach telefonicznych
// dla bieżącego użytkownika (ta sama logika co enforceReportingBlocks / banner).
export default function useOverdueReports(currentUser) {
  const [overdueMeetings, setOverdueMeetings] = useState([]);
  const [overduePhones, setOverduePhones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.email) return;
    let cancelled = false;

    const run = async () => {
      try {
        const today = startOfDay(new Date());

        const [
          assignments,
          reports,
          visitReports,
          allowedUsers,
          calendarEvents,
          cacheRows,
          phoneContacts,
          phoneReports,
        ] = await Promise.all([
          base44.entities.MeetingAssignment.filter({ assigned_user_email: currentUser.email }),
          base44.entities.MeetingReport.filter({ author_email: currentUser.email }),
          base44.entities.VisitReport.filter({ author_email: currentUser.email }),
          base44.entities.AllowedUser.list(),
          base44.entities.CalendarEvent.filter({ owner_email: currentUser.email }),
          base44.entities.MeetingsCache.filter({ cache_key: "meetings_lite" }, "-updated_date", 1),
          base44.entities.PhoneContact.filter({ assigned_user_email: currentUser.email }),
          base44.entities.PhoneContactReport.filter({ author_email: currentUser.email }),
        ]);

        // Zwolnienie z obowiązku raportowania
        const ua = allowedUsers.find((u) => (u.data?.email || u.email) === currentUser.email);
        const isExempt = ua?.data?.exempt_from_reports || ua?.exempt_from_reports || false;
        if (isExempt) {
          if (!cancelled) { setOverdueMeetings([]); setOverduePhones([]); }
          return;
        }

        // --- Zaległe raporty po spotkaniach ---
        const reportsIndex = buildMeetingReportsIndex([...reports, ...visitReports]);
        const cacheRecord = cacheRows[0]?.data || cacheRows[0] || null;
        const cachedMeetings = cacheRecord?.meetings_json?.meetings || [];
        const cachedByKey = new Map(
          cachedMeetings.map((m) => [`${m.sheet}__${m.client_name}__${m.meeting_calendar}`, m])
        );

        const postponedClientKeys = new Set();
        for (const ev of calendarEvents) {
          if (ev.status !== "postponed" || !ev.postponed_to) continue;
          const newDay = parseMeetingDate(ev.postponed_to);
          if (!newDay || startOfDay(newDay) <= today) continue;
          const key = normalizePhoneLast9(ev.client_phone) || normalizeName(ev.client_name);
          if (key) postponedClientKeys.add(key);
        }

        const deduped = new Map();
        for (const a of assignments) {
          const cached = cachedByKey.get(a.meeting_key) || {};
          const merged = {
            ...cached,
            ...a,
            client_name: a.client_name || cached.client_name || "",
            client_phone: a.client_phone || cached.phone || cached.client_phone || "",
            comments: cached.comments || a.comments || "",
            interview_data: cached.interview_data || a.interview_data || {},
            meeting_calendar: a.meeting_calendar || cached.meeting_calendar || "",
            meeting_date: a.meeting_date || cached.meeting_date || "",
            status: cached.status || a.status || "",
            assigned_user_email: currentUser.email,
          };
          const day = parseMeetingDate(merged.meeting_calendar || merged.meeting_date);
          if (!day) continue;
          const keyId = normalizePhoneLast9(merged.client_phone) || normalizeName(merged.client_name);
          if (!keyId) continue;
          const ex = deduped.get(keyId);
          const exDay = ex ? parseMeetingDate(ex.meeting_calendar || ex.meeting_date) : null;
          if (!ex || (day && exDay && day > exDay)) deduped.set(keyId, merged);
        }

        const missingMeetings = Array.from(deduped.values()).filter((m) => {
          const day = parseMeetingDate(m.meeting_calendar || m.meeting_date);
          if (!day) return false;
          const d = startOfDay(day);
          if (d >= today) return false;
          if ((m.meeting_date || "") < GRACE_START_DATE) return false;
          if (getBusinessDaysElapsed(d, today) <= MAX_ALLOWED_BUSINESS_DAYS) return false;
          const ck = normalizePhoneLast9(m.client_phone) || normalizeName(m.client_name);
          if (ck && postponedClientKeys.has(ck)) return false;
          return !hasReportForMeeting(m, reportsIndex);
        });

        // --- Zaległe raporty po kontaktach telefonicznych ---
        const phoneReportKeys = new Set(
          phoneReports.map((r) => (r.contact_key || "").trim()).filter(Boolean)
        );
        const clientToPhoneDates = new Map();
        for (const r of phoneReports) {
          const nameKey = normalizeName(r.client_name);
          if (nameKey) clientToPhoneDates.set(nameKey, localYMD(r.contact_date));
        }
        const missingPhones = phoneContacts.filter((c) => {
          const dateStr =
            c.contact_date ||
            (c.contact_calendar ? localYMD(c.contact_calendar) : "") ||
            (c.date ? localYMD(c.date) : "");
          const day = parseMeetingDate(dateStr);
          if (!day) return false;
          const d = startOfDay(day);
          if (d >= today) return false;
          if (dateStr < GRACE_START_DATE) return false;
          if (getBusinessDaysElapsed(d, today) <= MAX_ALLOWED_BUSINESS_DAYS) return false;
          const ck = (c.contact_key || "").trim();
          if (ck && phoneReportKeys.has(ck)) return false;
          return !hasMeaningfulPhoneReport(c, phoneReportKeys, clientToPhoneDates);
        });

        if (cancelled) return;
        setOverdueMeetings(missingMeetings);
        setOverduePhones(missingPhones);
      } catch (e) {
        // błędy nie powinny blokować UI — zostaw puste listy
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    const handler = () => run();
    window.addEventListener("user-access-updated", handler);
    return () => {
      cancelled = true;
      window.removeEventListener("user-access-updated", handler);
    };
  }, [currentUser?.email]);

  return { overdueMeetings, overduePhones, loading };
}

// Kontakt uznajemy za zaraportowany, gdy ma znaczące dane inline (komentarze/
// wywiad) albo istnieje dedykowany PhoneContactReport po kluczu/kliencie+data.
function hasMeaningfulPhoneReport(contact, phoneReportKeys, clientToPhoneDates) {
  const inline =
    (contact.comments && String(contact.comments).trim().length > 2) ||
    (contact.interview_data &&
      typeof contact.interview_data === "object" &&
      Object.values(contact.interview_data).some((v) =>
        v != null && (typeof v !== "string" || v.trim().length > 0)
      ));
  if (inline) return true;
  const ck = (contact.contact_key || "").trim();
  if (ck && phoneReportKeys.has(ck)) return true;
  const nameKey = normalizeName(contact.client_name);
  if (nameKey && clientToPhoneDates.has(nameKey)) return true;
  return false;
}