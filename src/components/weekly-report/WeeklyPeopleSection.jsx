import React from "react";
import { Badge } from "@/components/ui/badge";
import WeeklyRoleBadge from "@/components/weekly-report/WeeklyRoleBadge";

function PeopleList({ title, items, countKey }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h4 className="mb-3 text-sm font-semibold text-slate-800">{title}</h4>
      <div className="space-y-3">
        {items.length === 0 && <p className="text-sm text-gray-500">Brak danych.</p>}
        {items.map((person, index) => (
          <div key={`${person.email || person.name}-${index}`} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-medium text-slate-800">{person.name}</div>
                <div className="text-sm text-gray-500">{person.email || "—"}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <WeeklyRoleBadge role={person.role} />
                <Badge className="border-green-200 bg-green-100 text-green-700">{person[countKey]}</Badge>
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
      <h3 className="mb-3 text-base font-semibold text-slate-800">Doradcy</h3>
      <div className="grid gap-4 lg:grid-cols-2">
        <PeopleList title="Przypisane spotkania" items={advisors} countKey="assigned" />
        <PeopleList title="Raportujący" items={reporters} countKey="reports" />
      </div>
    </section>
  );
}