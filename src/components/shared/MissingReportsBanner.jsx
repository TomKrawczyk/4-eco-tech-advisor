import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, X, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { startOfDay, addDays } from "date-fns";

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
      const pastLimit = addDays(today, -30);

      const [assignments, reports, allowedUsers] = await Promise.all([
        base44.entities.MeetingAssignment.filter({ assigned_user_email: currentUser.email }),
        base44.entities.MeetingReport.filter({ author_email: currentUser.email }),
        base44.entities.AllowedUser.list(),
      ]);

      const ua = allowedUsers.find(u => (u.data?.email || u.email) === currentUser.email);
      setIsBlocked(ua?.data?.is_blocked || ua?.is_blocked || false);

      const missing = assignments.filter(a => {
        const meetingDay = parseMeetingDate(a.meeting_calendar || a.meeting_date);
        if (!meetingDay) return false;
        const day = startOfDay(meetingDay);
        if (day >= today || day < pastLimit) return false; // tylko przeszłe w oknie 30 dni

        const reportExists = reports.some(r => {
          // Raport musi być od tego samego autora LUB nie mieć autora (stare raporty)
          const authorMatch = !r.author_email || r.author_email === currentUser.email;
          if (!authorMatch) return false;
          // Normalizuj imiona — lowercase, trim, usuń wielokrotne spacje
          const normalize = s => (s || "").toLowerCase().trim().replace(/\s+/g, " ").replace(/\s*-\s*/g, "-");
          const rName = normalize(r.client_name);
          const aName = normalize(a.client_name);
          // Pełne dopasowanie LUB pierwsze słowo (imię) się zgadza
          const nameMatch = rName === aName || (rName.length > 2 && aName.startsWith(rName)) || (aName.length > 2 && rName.startsWith(aName));
          if (!nameMatch) return false;
          // Data raportu blisko daty spotkania (±5 dni) lub brak daty raportu
          const reportDay = parseMeetingDate(r.meeting_date);
          const dateClose = !reportDay || Math.abs(startOfDay(reportDay) - day) <= 5 * 86400000;
          return dateClose;
        });
        return !reportExists;
      });

      setMissingMeetings(missing);
    };

    check();
  }, [currentUser?.email]);

  // Blokada — zawsze widoczna, nie można zamknąć
  if (isBlocked) {
    return (
      <div className="bg-red-600 text-white px-4 py-3 text-sm flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <div className="flex-1">
          <span className="font-bold">KONTO ZABLOKOWANE – </span>
          <span>Masz niezłożone raporty po spotkaniach. Złóż raporty aby odblokować dostęp do funkcji aplikacji.</span>
        </div>
        <Link
          to={createPageUrl("MeetingReports")}
          className="shrink-0 bg-white text-red-600 font-semibold px-3 py-1 rounded-lg text-xs hover:bg-red-50 transition-colors"
        >
          Złóż raport
        </Link>
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
          Masz {missingMeetings.length} {missingMeetings.length === 1 ? "spotkanie" : "spotkań"} bez raportu.{" "}
          Brak raportowania może skutkować blokadą konta.
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