import React, { useState } from "react";
import { createPortal } from "react-dom";
import { X, AlertCircle } from "lucide-react";

const BASE_REASONS = ["Niezainteresowany", "Nie odpowiada", "Błędny numer", "Klient już ma instalację", "Inny"];

export default function ResignModal({ open, onClose, onConfirm, isMeeting }) {
  const [reason, setReason] = useState("");
  const [other, setOther] = useState("");
  if (!open) return null;

  const reasons = isMeeting ? [...BASE_REASONS, "Klient odwołał spotkanie"] : BASE_REASONS;
  const finalReason = reason === "Inny" ? other.trim() : reason;
  const canConfirm = reason && (reason !== "Inny" || other.trim());

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500" /> Rezygnuję
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Wybierz powód. {isMeeting ? "Spotkanie" : "Kontakt"} zostanie zarchiwizowane i wygeneruje się raport.
        </p>
        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          {reasons.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors ${
                reason === r ? "border-red-500 bg-red-50 text-red-700 font-medium" : "border-gray-200 hover:bg-gray-50 text-gray-700"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        {reason === "Inny" && (
          <input
            value={other}
            onChange={(e) => setOther(e.target.value)}
            placeholder="Podaj powód"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
          />
        )}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700"
          >
            Anuluj
          </button>
          <button
            onClick={() => { if (canConfirm) onConfirm(finalReason); }}
            disabled={!canConfirm}
            className="flex-1 px-3 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium transition-colors"
          >
            Potwierdź
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}