import React, { useState } from "react";
import { Phone, CalendarPlus, User, MapPin, FileText, Building2, Clock, MapPinned, AlertCircle } from "lucide-react";
import {
  maskName, maskPhone, formatPhone, extractCity,
  isSlaBreached, isFresh, isMeetingNear, buildGoogleCalendarUrl,
} from "@/lib/gieldaData";
import ResignModal from "./ResignModal";

export default function GieldaPinCard({ pin, geo, currentUser, onClaim, claimed, busy, onResign }) {
  const [showResign, setShowResign] = useState(false);
  if (!pin) return null;

  const isMeeting = pin.type === "spotkanie";
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
  const near = isMeeting && !claimed && isMeetingNear(pin);
  const showFull = claimed || pin.assigned_user_email === currentUser?.email;
  const isMine = pin.isAssigned && pin.assigned_user_email === currentUser?.email;

  return (
    <div className={`rounded-xl border p-3 space-y-2 transition-all ${
      claimed ? "border-green-300 bg-green-50" : sla ? "border-red-200 bg-red-50/40" : "border-gray-200 bg-white"
    }`}>
      {isMeeting && pin.meeting_calendar && (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          {pin.meeting_calendar}
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2.5 h-2.5 ${isMeeting ? "bg-blue-500 rotate-45" : claimed ? "bg-green-500" : pin.source === "PhoneContact" && pin.phone_status === "Kontakt do doradcy" ? "bg-red-500" : pin.source === "PhoneContact" && pin.phone_status === "Do ponownego kontaktu" ? "bg-orange-500" : "bg-yellow-500"}`} />
            <span className="font-semibold text-sm text-gray-900 truncate">
              {showFull ? pin.client_name || "Klient" : maskName(pin.client_name)}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-gray-500 mt-0.5">
            <Building2 className="w-3 h-3" />
            {sourceLabel}
          </div>
        </div>
        {fresh && !claimed && !isMeeting && (
          <span className="text-[10px] font-medium text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> nowe
          </span>
        )}
        {near && (
          <span className="text-[10px] font-medium text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full shrink-0 animate-pulse">≤48h</span>
        )}
        {sla && !claimed && !isMeeting && (
          <span className="text-[10px] font-medium text-red-700 bg-red-100 px-1.5 py-0.5 rounded-full shrink-0">SLA</span>
        )}
      </div>

      <div className="space-y-1 text-xs text-gray-700">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-gray-500 shrink-0" />
          <span>{city || "—"}{pin.postal_code ? `, ${pin.postal_code}` : ""}</span>
        </div>
        {isMeeting ? (
          <>
            {pin.sheet && (
              <div className="flex items-center gap-1.5">
                <MapPinned className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                <span>Region: {pin.sheet}</span>
              </div>
            )}
            {pin.meeting_calendar && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                <span>Termin: {pin.meeting_calendar}</span>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            <span>Typ instalacji: {installType}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5 text-gray-500 shrink-0" />
          <span className="font-mono">
            {showFull ? formatPhone(pin.client_phone) : maskPhone(pin.client_phone)}
          </span>
        </div>
      </div>

      {showFull && (
        <div className="space-y-1.5 pt-1 border-t border-gray-200">
          {pin.client_address && (
            <div className="text-xs text-gray-700">
              <span className="text-gray-500">Adres: </span>{pin.client_address}
            </div>
          )}
          {pin.notes && (
            <div className="text-xs text-gray-700">
              <span className="text-gray-500">{isMeeting ? "Uwagi: " : "Notatki: "}</span>{pin.notes}
            </div>
          )}
          {pin.assigned_at && (
            <div className="text-[11px] text-gray-500 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Przejęto: {new Date(pin.assigned_at).toLocaleString()}
            </div>
          )}
          {pin.phone_status && (
            <div className="text-[11px] text-gray-500">Status: {pin.phone_status}</div>
          )}
          <div className="flex gap-2.5 pt-1">
            {pin.client_phone && (
              <a
                href={`tel:${String(pin.client_phone).replace(/\s/g, "")}`}
                className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-xs font-semibold py-2.5 rounded-lg shadow-sm hover:shadow transition-all"
              >
                <Phone className="w-4 h-4" /> Zadzwoń
              </a>
            )}
            {isMeeting ? (
              <a
                href={buildGoogleCalendarUrl(pin)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 bg-blue-800 hover:bg-blue-900 active:bg-blue-950 text-white text-xs font-semibold py-2.5 rounded-lg shadow-sm hover:shadow transition-all"
              >
                <CalendarPlus className="w-4 h-4" /> Dodaj do kalendarza
              </a>
            ) : (
              <a
                href="/Calendar"
                className="flex-1 flex items-center justify-center gap-1.5 bg-blue-800 hover:bg-blue-900 active:bg-blue-950 text-white text-xs font-semibold py-2.5 rounded-lg shadow-sm hover:shadow transition-all"
              >
                <CalendarPlus className="w-4 h-4" /> Umów spotkanie
              </a>
            )}
          </div>
          {isMine && (
            <button
              onClick={() => setShowResign(true)}
              className="w-full flex items-center justify-center gap-1.5 text-red-600 hover:bg-red-50 border border-red-200 text-xs font-medium py-2 rounded-lg transition-colors mt-1"
            >
              <AlertCircle className="w-3.5 h-3.5" /> Rezygnuję
            </button>
          )}
        </div>
      )}

      <ResignModal
        open={showResign}
        onClose={() => setShowResign(false)}
        onConfirm={(reason) => { setShowResign(false); onResign?.(pin, reason); }}
        isMeeting={isMeeting}
      />

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