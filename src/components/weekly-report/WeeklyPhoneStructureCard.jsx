import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import WeeklyPhoneContactsTable from "@/components/weekly-report/WeeklyPhoneContactsTable";

function coverageBadge(value) {
  if (value === null || value === undefined) return "border-gray-200 bg-gray-100 text-gray-700";
  if (value >= 80) return "border-green-200 bg-green-100 text-green-700";
  if (value >= 50) return "border-amber-200 bg-amber-100 text-amber-700";
  return "border-red-200 bg-red-100 text-red-700";
}

export default function WeeklyPhoneStructureCard({ structure }) {
  const [open, setOpen] = useState(false);
  const metrics = structure?.metrics || {};
  const missing = metrics.phone_contacts_missing ?? 0;
  const assigned = metrics.phone_contacts_assigned ?? 0;
  const coverage = metrics.phone_contacts_coverage_pct;

  return (
    <Card className="overflow-hidden rounded-xl border border-gray-200 bg-white text-slate-800 shadow-sm">
      <button onClick={() => setOpen(!open)} className="w-full text-left transition-colors hover:bg-gray-50">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-lg font-semibold text-slate-800">{structure?.name || "Bez struktury"}</div>
              <div className="mt-1 text-sm text-gray-500">{assigned} kontaktów telefonicznych</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-red-200 bg-red-100 text-red-700">{missing} z {assigned} bez raportu</Badge>
              <Badge className={coverageBadge(coverage)}>
                Pokrycie: {coverage === null || coverage === undefined ? "—" : `${coverage}%`}
              </Badge>
              <div className="rounded-xl border border-gray-200 bg-white p-2 text-slate-500">
                {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>
          </div>
        </CardContent>
      </button>
      {open && (
        <div className="border-t border-gray-200 bg-gradient-to-br from-green-50/60 via-white to-white p-4 md:p-5">
          <WeeklyPhoneContactsTable contacts={structure?.phone_contacts || []} metrics={metrics} />
        </div>
      )}
    </Card>
  );
}