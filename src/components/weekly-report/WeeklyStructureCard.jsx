import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import WeeklyPeopleSection from "@/components/weekly-report/WeeklyPeopleSection";
import WeeklyClientsTable from "@/components/weekly-report/WeeklyClientsTable";

function coverageBadge(value) {
  if (value === null || value === undefined) return "border-gray-200 bg-gray-100 text-gray-700";
  if (value >= 70) return "border-green-200 bg-green-100 text-green-700";
  if (value >= 30) return "border-amber-200 bg-amber-100 text-amber-700";
  return "border-red-200 bg-red-100 text-red-700";
}

export default function WeeklyStructureCard({ structure }) {
  const [open, setOpen] = useState(false);
  const coverage = structure.metrics.report_coverage_pct;

  return (
    <Card className="overflow-hidden rounded-xl border border-gray-200 bg-white text-slate-800 shadow-sm">
      <button onClick={() => setOpen(!open)} className="w-full text-left transition-colors hover:bg-gray-50">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-lg font-semibold text-slate-800">{structure.name}</div>
              <div className="mt-1 text-sm text-gray-500">{structure.metrics.meetings_assigned} spotkań umówionych</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={coverageBadge(coverage)}>{coverage === null ? "—" : `${coverage}% raportów`}</Badge>
              {structure.metrics.missing_reports > 0 && (
                <Badge className="border-red-200 bg-red-100 text-red-700">brak {structure.metrics.missing_reports} raportów</Badge>
              )}
              <div className="rounded-xl border border-gray-200 bg-white p-2 text-slate-500">
                {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>
          </div>
        </CardContent>
      </button>
      {open && (
        <div className="border-t border-gray-200 bg-gradient-to-br from-green-50/60 via-white to-white p-4 md:p-5">
          <div className="space-y-5">
            <WeeklyPeopleSection advisors={structure.advisors_assigned || []} reporters={structure.reporters || []} />
            <WeeklyClientsTable clients={structure.clients || []} />
          </div>
        </div>
      )}
    </Card>
  );
}