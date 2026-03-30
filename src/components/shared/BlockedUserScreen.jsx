import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, FileText, Calendar, Phone, MapPin, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { startOfDay } from "date-fns";

const BLOCK_AFTER_DAYS = 7;

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
  const [missingPhoneContacts, setMissingPhoneContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.email) return;
    const load = async () => {
      const today = startOfDay(new Date());
      const normalize = s => (s || "").toLowerCase().trim().replace(/\s+/g, " ").replace(/\s*-\s*/g, "-");
      const normalizePhone = p => (p || "").replace(/\s+/g, "").replace(/[^\d]/g, "");

      const [assignments, reports, visitReports, phoneContacts, phoneReports] = await Promise.all([
        base44.entities.MeetingAssignment.filter({ assigned_user_email: currentUser.email }),
        base44.entities.MeetingReport.filter({ author_email: currentUser.email }),
        base44.entities.VisitReport.filter({ author_email: currentUser.email }),
        base44.entities.PhoneContact.filter({ assigned_user_email: currentUser.email }),
        base44.entities.PhoneContactReport.filter({ author_email: currentUser.email }),
      ]);

      const allReports = [...reports, ...visitReports];

      // Brakujące raporty po spotkaniach
      const deduped = new Map();
      for (const a of assignments) {
        const meetingDay = parseMeetingDate(a.meeting_calendar || a.meeting_date);
        if (!meetingDay) continue;
        const keyId = normalizePhone(a.client_phone) || normalize(a.client_name);
        if (!keyId) continue;
        const existing = deduped.get(keyId);
        if (!existing || meetingDay > parseMeetingDate(existing.meeting_calendar || existing.meeting_date)) {
          deduped.set(keyId, a);
        }
      }

      const missing = Array.from(deduped.values()).filter(a => {
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

      missing.sort((a, b) => {
        const da = parseMeetingDate(a.meeting_calendar || a.meeting_date);
        const db = parseMeetingDate(b.meeting_calendar || b.meeting_date);
        return (da || 0) - (db || 0);
      });

      setMissingMeetings(missing);

      // Brakujące kontakty telefoniczne (>= 7 dni od przypisania)
      const missingPhones = phoneContacts.filter(c => {
        const assignedDate = new Date(c.updated_date || c.created_date);
        const assignedDay = startOfDay(assignedDate);
        const daysAgo = Math.floor((today - assignedDay) / 86400000);
        if (daysAgo < BLOCK_AFTER_DAYS) return false;
        const cPhone = normalizePhone(c.phone || c.client_phone);
        const cName = normalize(c.client_name);
        return !phoneReports.some(r => {
          const rPhone = normalizePhone(r.client_phone);
          const rName = normalize(r.client_name);
          const phoneMatch = cPhone.length >= 7 && rPhone.length >= 7 && cPhone === rPhone;
          const nameMatch = rName === cName || (rName.length > 2 && cName.startsWith(rName)) || (cName.length > 2 && rName.startsWith(cName));
          return phoneMatch || nameMatch;
        });
      });

      setMissingPhoneContacts(missingPhones);
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

        {/* Lista brakujących raportów po spotkaniach */}
        {(loading || missingMeetings.length > 0) && (
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
        )}

        {/* Lista brakujących kontaktów telefonicznych */}
        {!loading && missingPhoneContacts.length > 0 && (
          <div className="bg-white rounded-xl border border-orange-200 shadow-sm overflow-hidden mb-4">
            <div className="bg-orange-50 px-4 py-3 border-b border-orange-200">
              <h3 className="font-semibold text-orange-800 text-sm flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Kontakty telefoniczne bez raportu ({missingPhoneContacts.length})
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {missingPhoneContacts.map((c, i) => (
                <Link
                  key={i}
                  to={createPageUrl("PhoneContacts")}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-orange-50 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-gray-900">{c.client_name}</div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500 mt-0.5">
                      {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
                      {c.address && <span className="flex items-center gap-1 truncate"><MapPin className="w-3 h-3" />{c.address}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-orange-600 text-xs font-medium shrink-0 group-hover:gap-2 transition-all">
                    <Phone className="w-3.5 h-3.5" />
                    <span>Zadzwoń i zaraportuj</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {!loading && missingMeetings.length === 0 && missingPhoneContacts.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-500 text-sm mb-4">
            Brak zaległości – odśwież stronę aby odblokować konto.
          </div>
        )}

        <p className="text-center text-xs text-gray-400">
          Po uzupełnieniu wszystkich raportów konto zostanie odblokowane automatycznie.
        </p>
      </div>
    </div>
  );
}