import React from "react";
import { Phone, CalendarPlus, User, MapPin, FileText, Building2, Clock } from "lucide-react";
import { maskName, maskPhone, formatPhone, extractCity, isSlaBreached, isFresh } from "@/lib/gieldaData";

export default function GieldaPinCard({ pin, geo, currentUser, onClaim, claimed, busy }) {
  if (!pin) return null;

  const city = extractCity(pin.client_address, geo?.city);
  const sourceLabel =
    pin.source === "ContactLead" ? "Paczka kontaktów" :
    pin.source === "MeetingAssignment" ? "Spotkanie z arkusza" :
    "Kontakt telefoniczny";

  const installType = pin.extra_data && Object.keys(pin.extra_data).length > 0
    ? (pin.extra_data["Typ instalacji"] || pin.extra_data["typ instalacji"] || pin.extra_data["Instalacja"] || "—")
    : "—";

  const sla = isSlaBreached(pin);
  const fresh = isFresh(pin);

  return (
    <div className={`rounded-xl border p-3 space-y-2 transition-all ${
      claimed ? "border-green-300 bg-green-50" : sla ? "border-red-200 bg-red-50/40" : "border-gray-200 bg-white"
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${pin.type === "spotkanie" ? "bg-blue-500 rotate-45" : claimed ? "bg-green-500" : sla ? "bg-red-500" : "bg-yellow-500"}`} />
            <span className="font-semibold text-sm text-gray-900 truncate">
              {claimed || pin.assigned_user_email === currentUser?.email ? pin.client_name || "Klient" : maskName(pin.client_name)}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-gray-500 mt-0.5">
            <Building2 className="w-3 h-3" />
            {sourceLabel}
          </div>
        </div>
        {fresh && !claimed && (
          <span className="text-[10px] font-medium text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> nowe
          </span>
        )}
        {sla && !claimed && (
          <span className="text-[10px] font-medium text-red-700 bg-red-100 px-1.5 py-0.5 rounded-full shrink-0">SLA</span>
        )}
      </div>

      <div className="space-y-1 text-xs text-gray-700">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span>{city || "—"}{pin.postal_code ? `, ${pin.postal_code}` : ""}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span>Typ instalacji: {installType}</span>
        </div>
        {pin.type === "spotkanie" && pin.meeting_calendar && (
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span>Termin: {pin.meeting_calendar}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="font-mono">
            {claimed || pin.assigned_user_email === currentUser?.email ? formatPhone(pin.client_phone) : maskPhone(pin.client_phone)}
          </span>
        </div>
      </div>

      {claimed && (
        <div className="space-y-1.5 pt-1 border-t border-green-200">
          {pin.client_address && (
            <div className="text-xs text-gray-700">
              <span className="text-gray-400">Adres: </span>{pin.client_address}
            </div>
          )}
          {pin.notes && (
            <div className="text-xs text-gray-700">
              <span className="text-gray-400">Notatki: </span>{pin.notes}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            {pin.client_phone && (
              <a
                href={`tel:${String(pin.client_phone).replace(/\s/g, "")}`}
                className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium py-2 rounded-lg transition-colors"
              >
                <Phone className="w-3.5 h-3.5" /> Zadzwoń
              </a>
            )}
            <a
              href={`https://4-ecodoradca.base44.app/Calendar`}
              className="flex-1 flex items-center justify-center gap-1.5 bg-navy-700 hover:bg-navy-800 text-white text-xs font-medium py-2 rounded-lg transition-colors"
              style={{ backgroundColor: "#0B1437" }}
            >
              <CalendarPlus className="w-3.5 h-3.5" /> Umów spotkanie
            </a>
          </div>
        </div>
      )}

      {!claimed && !pin.assigned_user_email && (
        <button
          onClick={() => onClaim(pin)}
          disabled={busy}
          className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-xs font-semibold py-2 rounded-lg transition-colors"
        >
          {busy ? "Przejmuję..." : "Podejmij"}
        </button>
      )}

      {pin.assigned_user_email && pin.assigned_user_email === currentUser?.email && !claimed && (
        <div className="text-[11px] text-green-700 font-medium flex items-center gap-1">
          <User className="w-3 h-3" /> Przez Ciebie podjęte
        </div>
      )}
    </div>
  );
}