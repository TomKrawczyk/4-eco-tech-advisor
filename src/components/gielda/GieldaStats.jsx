import React from "react";
import { Clock, MapPin, CheckCircle2, AlertTriangle } from "lucide-react";

export default function GieldaStats({ pins, currentUserEmail }) {
  const niepodjete = pins.filter((p) => !p.isAssigned && p.type === "kontakt").length;
  const spotkania = pins.filter((p) => !p.isAssigned && p.type === "spotkanie").length;
  const podjeteDzis = pins.filter((p) => isClaimedTodayCheck(p)).length;
  const sla = pins.filter((p) => !p.isAssigned && p.type === "kontakt" && isSla(p)).length;

  const tiles = [
    { label: "Niepodjęte kontakty", value: niepodjete, icon: MapPin, color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
    { label: "Spotkania do przejęcia", value: spotkania, icon: Clock, color: "text-blue-600 bg-blue-50 border-blue-200" },
    { label: "Podjęte dzisiaj", value: podjeteDzis, icon: CheckCircle2, color: "text-green-600 bg-green-50 border-green-200" },
    { label: "Przekroczone SLA (>24h)", value: sla, icon: AlertTriangle, color: "text-red-600 bg-red-50 border-red-200" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
      {tiles.map((t) => (
        <div key={t.label} className={`rounded-xl border p-3 ${t.color}`}>
          <div className="flex items-center gap-2">
            <t.icon className="w-4 h-4 shrink-0" />
            <span className="text-[11px] sm:text-xs font-medium leading-tight">{t.label}</span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold mt-1">{t.value}</div>
        </div>
      ))}
    </div>
  );
}

function isSla(p) {
  const base = p.assigned_at || p.updated_date || p.created_date;
  if (!base) return false;
  return Date.now() - new Date(base).getTime() > 24 * 60 * 60 * 1000;
}

function isClaimedTodayCheck(p) {
  if (!p.isAssigned) return false;
  const base = p.assigned_at || p.updated_date || p.created_date;
  if (!base) return false;
  const d = new Date(base);
  const today = new Date();
  return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
}