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
        if (!a.meeting_calendar) return false;
        const d = parseMeetingDate(a.meeting_calendar || a.meeting_date);
        if (!d) return false;
        const day = startOfDay(d);
        if (day >= today || day < pastLimit) return false; // tylko przeszłe

        const reportExists = reports.some(r => {
          const nameMatch = (r.client_name || "").toLowerCase().trim() === (a.client_name || "").toLowerCase().trim();
          const authorMatch = !r.author_email || r.author_email === currentUser.email;
          return nameMatch && authorMatch;
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