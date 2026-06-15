import React from "react";
import { Badge } from "@/components/ui/badge";
import WeeklyRoleBadge from "@/components/weekly-report/WeeklyRoleBadge";

function PeopleList({ title, items, countKey }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <h4 className="mb-3 text-sm font-semibold text-slate-200">{title}</h4>
      <div className="space-y-3">
        {items.length === 0 && <p className="text-sm text-slate-500">Brak danych.</p>}
        {items.map((person, index) => (
          <div key={`${person.email || person.name}-${index}`} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-medium text-slate-100">{person.name}</div>
                <div className="text-sm text-slate-400">{person.email || "—"}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <WeeklyRoleBadge role={person.role} />
                <Badge className="border-slate-700 bg-slate-800 text-slate-100">{person[countKey]}</Badge>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WeeklyPeopleSection({ advisors, reporters }) {
  return (
    <section>
      <h3 className="mb-3 text-base font-semibold text-white">Doradcy</h3>
      <div className="grid gap-4 lg:grid-cols-2">
        <PeopleList title="Przypisane spotkania" items={advisors} countKey="assigned" />
        <PeopleList title="Raportujący" items={reporters} countKey="reports" />
      </div>
    </section>
  );
}