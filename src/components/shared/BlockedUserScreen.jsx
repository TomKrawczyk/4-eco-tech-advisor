import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, FileText, Phone, Calendar, MapPin, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";
import useOverdueReports from "@/hooks/useOverdueReports";

export default function BlockedUserScreen({ currentUser }) {
  const blockedUntil = currentUser?.blocked_until || "";
  const isAdminTimedBlock = !!blockedUntil;
  const { overdueMeetings, overduePhones, loading } = useOverdueReports(currentUser);

  const totalOverdue = overdueMeetings.length + overduePhones.length;

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl rounded-3xl border border-red-200 bg-white shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-green-600 to-green-700 px-8 py-6 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-100" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{blockedUntil ? "Blokada czasowa konta" : "Konto zablokowane"}</h1>
              <p className="text-sm text-green-50">
                {blockedUntil
                  ? `Dostęp zablokowany do ${new Date(blockedUntil).toLocaleDateString("pl-PL")} włącznie.`
                  : "Uzupełnij zaległe raporty, aby odzyskać dostęp do aplikacji."}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 md:p-8 space-y-5">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <div className="text-sm font-semibold text-red-800 mb-2">Powód blokady</div>
            <p className="text-sm text-red-700">{currentUser?.blocked_reason || "Brak wymaganego raportowania."}</p>
            {currentUser?.blocked_at && (
              <p className="text-xs text-red-600 mt-2">Zablokowano: {new Date(currentUser.blocked_at).toLocaleString("pl-PL")}</p>
            )}
          </div>

          {isAdminTimedBlock ? (
            <p className="text-sm text-gray-600 leading-6">
              Blokada została nałożona przez administratora i obowiązuje do
              <span className="font-medium text-gray-900"> {new Date(blockedUntil).toLocaleDateString("pl-PL")}</span>.
              Uzupełnienie raportów nie zdejmie jej wcześniej — skontaktuj się z przełożonym.
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-600 leading-6">
                Złóż wszystkie zaległe raporty poniżej — konto odblokuje się automatycznie po ich uzupełnieniu.
                Do tego czasu dostęp do pozostałych funkcji pozostaje zablokowany.
              </p>

              {loading ? (
                <div className="flex items-center justify-center py-8 text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" /> Wczytywanie zaległych raportów...
                </div>
              ) : totalOverdue === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center bg-green-50 border border-green-200 rounded-2xl">
                  <CheckCircle2 className="w-10 h-10 text-green-600 mb-2" />
                  <p className="text-sm font-medium text-green-800">Wszystkie zaległe raporty zostały uzupełnione.</p>
                  <p className="text-xs text-green-700 mt-1">Konto odblokuje się automatycznie w ciągu chwili.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {overdueMeetings.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Raporty po spotkaniach ({overdueMeetings.length})
                      </div>
                      <div className="space-y-2">
                        {overdueMeetings.map((m, i) => {
                          const params = new URLSearchParams({
                            from_meeting: "1",
                            prefill_client_name: m.client_name || "",
                            prefill_client_phone: m.client_phone || "",
                            prefill_client_address: m.client_address || m.address || "",
                            prefill_meeting_date: m.meeting_date || "",
                            prefill_meeting_time: (m.meeting_calendar || "").match(/(\d{1,2}:\d{2})/)?.[1] || "",
                          }).toString();
                          return (
                            <div key={i} className="bg-white border border-gray-200 rounded-xl p-3 flex items-start gap-3">
                              <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                                <Calendar className="w-4 h-4 text-green-700" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-gray-900 text-sm truncate">{m.client_name || "Klient"}</div>
                                <div className="text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                                  {m.meeting_date && <span>{m.meeting_date}</span>}
                                  {m.meeting_calendar && <span>{m.meeting_calendar}</span>}
                                  {(m.client_phone || m.phone) && <span>📞 {m.client_phone || m.phone}</span>}
                                </div>
                                {(m.client_address || m.address) && (
                                  <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5 truncate">
                                    <MapPin className="w-3 h-3 shrink-0" /> {m.client_address || m.address}
                                  </div>
                                )}
                              </div>
                              <Button asChild size="sm" className="bg-green-600 hover:bg-green-700 shrink-0">
                                <Link to={`${createPageUrl("MeetingReports")}?${params}`}>
                                  <FileText className="w-3.5 h-3.5 mr-1" /> Uzupełnij
                                </Link>
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {overduePhones.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Raporty po kontaktach telefonicznych ({overduePhones.length})
                      </div>
                      <div className="space-y-2">
                        {overduePhones.map((c, i) => (
                          <div key={i} className="bg-white border border-gray-200 rounded-xl p-3 flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                              <Phone className="w-4 h-4 text-blue-700" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-gray-900 text-sm truncate">{c.client_name || "Klient"}</div>
                              <div className="text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                                {c.contact_date && <span>{c.contact_date}</span>}
                                {(c.phone || c.client_phone) && <span>📞 {c.phone || c.client_phone}</span>}
                              </div>
                            </div>
                            <Button asChild size="sm" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50 shrink-0">
                              <Link to={`${createPageUrl("PhoneContacts")}`}>
                                <Phone className="w-3.5 h-3.5 mr-1" /> Uzupełnij
                              </Link>
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button asChild variant="outline" className="border-green-200 text-green-700 hover:bg-green-50">
                  <Link to={createPageUrl("MeetingReports")}>
                    <FileText className="w-4 h-4 mr-2" /> Raport po spotkaniu
                  </Link>
                </Button>
                <Button asChild variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50">
                  <Link to={createPageUrl("PhoneContacts")}>
                    <Phone className="w-4 h-4 mr-2" /> Raport po kontakcie
                  </Link>
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}