import React from "react";
import { Phone, MapPin } from "lucide-react";

// Pojedynczy wiersz zadania z szybkimi akcjami: zadzwoń / nawiguj
export default function TaskCard({ title, meta, note, badge, badgeClass = "bg-gray-100 text-gray-700", phone, address, onCall }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-gray-900 text-sm truncate">{title}</div>
          {meta && <div className="text-xs text-gray-500 mt-0.5 break-words">{meta}</div>}
        </div>
        {badge && (
          <span className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ${badgeClass}`}>{badge}</span>
        )}
      </div>

      {note && (
        <div className="mt-2 text-xs text-gray-600 whitespace-pre-wrap break-words">{note}</div>
      )}

      {(phone || address) && (
        <div className="flex gap-2 mt-3">
          {phone && (
            <a
              href={`tel:${String(phone).replace(/\s/g, "")}`}
              onClick={() => onCall?.()}
              className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors"
            >
              <Phone className="w-4 h-4" />
              Zadzwoń
            </a>
          )}
          {address && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-lg border border-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-50 transition-colors"
            >
              <MapPin className="w-4 h-4" />
              Nawiguj
            </a>
          )}
        </div>
      )}
    </div>
  );
}