import React, { useState } from "react";
import { createPortal } from "react-dom";
import { X, Undo2 } from "lucide-react";

const REASONS = ["Niezainteresowany", "Za daleko", "Brak czasu", "Inny"];

// "Nie podejmuj\u0119" \u2014 kontakt wraca na Gie\u0142d\u0119 dla innych handlowc\u00f3w.
// Pow\u00f3d jest opcjonalny (czysto informacyjny), nie blokuje potwierdzenia.
export default function ReleaseModal({ open, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const [other, setOther] = useState("");
  if (!open) return null;

  const finalReason = reason === "Inny" ? other.trim() : reason;

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Undo2 className="w-4 h-4 text-amber-500" /> Nie podejmuj\u0119
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Kontakt wr\u00f3ci na Gie\u0142d\u0119 dla innych handlowc\u00f3w, ale Ty go ju\u017c nie zobaczysz. Pow\u00f3d jest opcjonalny.
        </p>
        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          <button
            onClick={() => setReason("")}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors ${
              reason === "" ? "border-amber-500 bg-amber-50 text-amber-700 font-medium" : "border-gray-200 hover:bg-gray-50 text-gray-700"
            }`}
          >
            Bez powodu
          </button>
          {REASONS.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors ${
                reason === r ? "border-amber-500 bg-amber-50 text-amber-700 font-medium" : "border-gray-200 hover:bg-gray-50 text-gray-700"
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
            placeholder="Podaj pow\u00f3d"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400"
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
            onClick={() => onConfirm(finalReason)}
            className="flex-1 px-3 py-2 text-sm rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium transition-colors"
          >
            Oddaj na Gie\u0142d\u0119
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}