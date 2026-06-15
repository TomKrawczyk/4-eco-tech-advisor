import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import WeeklyPeopleSection from "@/components/weekly-report/WeeklyPeopleSection";
import WeeklyClientsTable from "@/components/weekly-report/WeeklyClientsTable";

function coverageBadge(value) {
  if (value === null || value === undefined) return "border-slate-700 bg-slate-800 text-slate-300";
  if (value >= 70) return "border-emerald-500/30 bg-emerald-500/15 text-emerald-200";
  if (value >= 30) return "border-amber-500/30 bg-amber-500/15 text-amber-200";
  return "border-red-500/30 bg-red-500/15 text-red-200";
}

export default function WeeklyStructureCard({ structure }) {
  const [open, setOpen] = useState(false);
  const coverage = structure.metrics.report_coverage_pct;

  return (
    <Card className="overflow-hidden border-slate-800 bg-slate-950 text-slate-100 shadow-lg shadow-black/20">
      <button onClick={() => setOpen(!open)} className="w-full text-left">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-lg font-semibold text-white">{structure.name}</div>
              <div className="mt-1 text-sm text-slate-400">{structure.metrics.meetings_assigned} spotkań umówionych</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={coverageBadge(coverage)}>{coverage === null ? "—" : `${coverage}% raportów`}</Badge>
              {structure.metrics.missing_reports > 0 && (
                <Badge className="border-red-500/30 bg-red-500/15 text-red-200">brak {structure.metrics.missing_reports} raportów</Badge>
              )}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-300">
                {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>
          </div>
        </CardContent>
      </button>
      {open && (
        <div className="border-t border-slate-800 bg-slate-900/60 p-4 md:p-5">
          <div className="space-y-5">
            <WeeklyPeopleSection advisors={structure.advisors_assigned || []} reporters={structure.reporters || []} />
            <WeeklyClientsTable clients={structure.clients || []} />
          </div>
        </div>
      )}
    </Card>
  );
}