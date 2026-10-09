import React from "react";
import { Users, CalendarDays, Phone, FileText, Layers } from "lucide-react";

const cards = [
  { key: "groups", label: "Grupy", icon: Layers, color: "text-emerald-600 bg-emerald-50" },
  { key: "members", label: "Członkowie", icon: Users, color: "text-blue-600 bg-blue-50" },
  { key: "meetings", label: "Spotkania (nadchodzące)", icon: CalendarDays, color: "text-violet-600 bg-violet-50", sub: (t) => `${t.meetingsAssigned}/${t.meetings} przypisane` },
  { key: "contacts", label: "Kontakty (aktywne)", icon: Phone, color: "text-amber-600 bg-amber-50", sub: (t) => `${t.contactsAssigned}/${t.contacts} przypisane` },
  { key: "reports", label: "Raporty (struktura)", icon: FileText, color: "text-rose-600 bg-rose-50" },
];

export default function DirectorSummaryCards({ totals, loading }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {cards.map((c) => {
        const Icon = c.icon;
        const value = loading ? "…" : totals[c.key];
        return (
          <div key={c.key} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.color}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{value}</div>
            <div className="text-[11px] text-gray-500 leading-tight">{c.label}</div>
            {c.sub && !loading && (
              <div className="text-[10px] text-gray-400 mt-0.5">{c.sub(totals)}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}