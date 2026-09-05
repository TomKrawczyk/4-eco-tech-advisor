import React from "react";
import { Clock, AlertTriangle, CalendarClock, CalendarDays, CheckCircle2, PhoneCall, RotateCcw } from "lucide-react";

const todayStr = () => new Date().toISOString().split("T")[0];
const addDays = (d, n) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().split("T")[0];
};

function isSla(p) {
  const base = p.assigned_at || p.updated_date || p.created_date;
  if (!base) return false;
  return Date.now() - new Date(base).getTime() > 24 * 60 * 60 * 1000;
}

function StatsGrid({ tiles }) {
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

export default function GieldaStats({ pins, currentUserEmail, tab }) {
  if (tab === "meeting") {
    const today = todayStr();
    const tomorrow = addDays(today, 1);
    const day2 = addDays(today, 2);
    const day3 = addDays(today, 3);
    const todayCount = pins.filter((p) => p.meeting_date === today).length;
    const tomorrowCount = pins.filter((p) => p.meeting_date === tomorrow).length;
    const laterCount = pins.filter((p) => p.meeting_date === day2 || p.meeting_date === day3).length;
    const toTake = pins.filter((p) => !p.isAssigned).length;
    return (
      <StatsGrid
        tiles={[
          { label: "Spotkania dziś", value: todayCount, icon: CalendarClock, color: "text-blue-600 bg-blue-50 border-blue-200" },
          { label: "Spotkania jutro", value: tomorrowCount, icon: CalendarDays, color: "text-blue-600 bg-blue-50 border-blue-200" },
          { label: "Pojutrze / +3 dni", value: laterCount, icon: Clock, color: "text-blue-600 bg-blue-50 border-blue-200" },
          { label: "Do przejęcia (łącznie)", value: toTake, icon: CheckCircle2, color: "text-green-600 bg-green-50 border-green-200" },
        ]}
      />
    );
  }

  // Zakładka "Kontakt telefoniczny"
  const noweLidy = pins.filter((p) => !p.isAssigned && p.source === "PhoneContact" && p.phone_status === "Kontakt do doradcy").length;
  const ponowne = pins.filter((p) => !p.isAssigned && p.source === "PhoneContact" && p.phone_status === "Do ponownego kontaktu").length;
  const moje = pins.filter((p) => p.isAssigned && p.assigned_user_email === currentUserEmail).length;
  const sla = pins.filter((p) => !p.isAssigned && isSla(p)).length;
  return (
    <StatsGrid
      tiles={[
        { label: "Nowe leady", value: noweLidy, icon: PhoneCall, color: "text-red-600 bg-red-50 border-red-200" },
        { label: "Do ponownego kontaktu", value: ponowne, icon: RotateCcw, color: "text-orange-600 bg-orange-50 border-orange-200" },
        { label: "Moje", value: moje, icon: CheckCircle2, color: "text-green-600 bg-green-50 border-green-200" },
        { label: "Przekroczone SLA", value: sla, icon: AlertTriangle, color: "text-red-600 bg-red-50 border-red-200" },
      ]}
    />
  );
}