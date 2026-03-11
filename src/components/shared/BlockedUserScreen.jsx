import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, FileText, Calendar, Phone, MapPin, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { startOfDay } from "date-fns";

function parseMeetingDate(str) {
  if (!str) return null;
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
  const plMatch = str.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (plMatch) return new Date(parseInt(plMatch[3]), parseInt(plMatch[2]) - 1, parseInt(plMatch[1]));
  return null;
}

export default function BlockedUserScreen({ currentUser }) {
  const [missingMeetings, setMissingMeetings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.email) return;
    const load = async () => {
      const today = startOfDay(new Date());
      const normalize = s => (s || "").toLowerCase().trim().replace(/\s+/g, " ").replace(/\s*-\s*/g, "-");
      const normalizePhone = p => (p || "").replace(/\s+/g, "").replace(/[^\d]/g, "");

      const [assignments, reports, visitReports] = await Promise.all([
        base44.entities.MeetingAssignment.filter({ assigned_user_email: currentUser.email }),
        base44.entities.MeetingReport.filter({ author_email: currentUser.email }),
        base44.entities.VisitReport.filter({ author_email: currentUser.email }),
      ]);

      const allReports = [...reports, ...visitReports];

      const missing = assignments.filter(a => {
        const meetingDay = parseMeetingDate(a.meeting_calendar || a.meeting_date);
        if (!meetingDay) return false;
        if (startOfDay(meetingDay) >= today) return false;

        const aName = normalize(a.client_name);
        const aPhone = normalizePhone(a.client_phone);

        return !allReports.some(r => {
          const rName = normalize(r.client_name);
          const rPhone = normalizePhone(r.client_phone);
          const phoneMatch = aPhone.length >= 7 && rPhone.length >= 7 && aPhone === rPhone;
          const nameMatch = rName === aName || (rName.length > 2 && aName.startsWith(rName)) || (aName.length > 2 && rName.startsWith(aName));
          return phoneMatch || nameMatch;
        });
      });

      // Sortuj od najstarszych
      missing.sort((a, b) => {
        const da = parseMeetingDate(a.meeting_calendar || a.meeting_date);
        const db = parseMeetingDate(b.meeting_calendar || b.meeting_date);
        return (da || 0) - (db || 0);
      });

      setMissingMeetings(missing);
      setLoading(false);
    };
    load();
  }, [currentUser?.email]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Konto zablokowane</h2>
          <p className="text-gray-600 text-sm">
            Twój dostęp do aplikacji został ograniczony z powodu braku raportów po spotkaniach.<br />
            Uzupełnij wszystkie brakujące raporty aby odblokować konto.
          </p>
        </div>

        {/* Lista brakujących spotkań */}
        <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden mb-4">
          <div className="bg-red-50 px-4 py-3 border-b border-red-200">
            <h3 className="font-semibold text-red-800 text-sm flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Spotkania bez raportu ({loading ? "…" : missingMeetings.length})
            </h3>
          </div>

          {loading ? (
            <div className="p-6 text-center">
              <div className="w-6 h-6 border-2 border-red-400 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : missingMeetings.length === 0 ? (
            <div className="p-6 text-center text-gray-500 text-sm">
              Brak brakujących raportów – odśwież stronę aby odblokować konto.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {missingMeetings.map((m) => {
                const meetingDate = parseMeetingDate(m.meeting_calendar || m.meeting_date);
                const dateStr = meetingDate
                  ? meetingDate.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" })
                  : "—";

                const prefillParams = new URLSearchParams({
                  from_meeting: "1",
                  prefill_client_name: m.client_name || "",
                  prefill_client_phone: m.client_phone || "",
                  prefill_client_address: m.client_address || "",
                  prefill_meeting_date: meetingDate ? meetingDate.toISOString().split("T")[0] : "",
                }).toString();

                return (
                  <Link
                    key={m.id}
                    to={`${createPageUrl("MeetingReports")}?${prefillParams}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-green-50 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-gray-900">{m.client_name}</div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500 mt-0.5">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{dateStr}</span>
                        {m.client_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{m.client_phone}</span>}
                        {m.client_address && <span className="flex items-center gap-1 truncate"><MapPin className="w-3 h-3" />{m.client_address}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-green-600 text-xs font-medium shrink-0 group-hover:gap-2 transition-all">
                      <FileText className="w-3.5 h-3.5" />
                      <span>Uzupełnij</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400">
          Po uzupełnieniu wszystkich raportów konto zostanie odblokowane automatycznie.
        </p>
      </div>
    </div>
  );
}