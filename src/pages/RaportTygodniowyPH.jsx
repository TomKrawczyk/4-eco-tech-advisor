import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, CalendarRange, FileText, PhoneCall, Users } from "lucide-react";
import { base44 } from "@/api/base44Client";
import useCurrentUser from "@/components/shared/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import WeeklyTotalsCard from "@/components/weekly-report/WeeklyTotalsCard";
import WeeklyStructureCard from "@/components/weekly-report/WeeklyStructureCard";

function coverageColor(value) {
  if (value === null || value === undefined) return "text-slate-100";
  if (value >= 70) return "text-emerald-300";
  if (value >= 30) return "text-amber-300";
  return "text-red-300";
}

export default function RaportTygodniowyPH() {
  const { currentUser, accessChecked } = useCurrentUser();
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [range, setRange] = useState({ from: "", to: "" });
  const [formError, setFormError] = useState("");
  const canView = currentUser?.role === "admin" || currentUser?.role === "owner";

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["weeklyStructureReport", range.from || "default", range.to || "default"],
    queryFn: async () => {
      const payload = range.from && range.to ? { from: range.from, to: range.to } : {};
      const response = await base44.functions.invoke("weeklyStructureReport", payload);
      return response.data;
    },
    enabled: accessChecked && canView,
  });

  const handleShow = () => {
    if ((fromInput && !toInput) || (!fromInput && toInput)) {
      setFormError("Uzupełnij obie daty.");
      return;
    }
    setFormError("");
    setRange({ from: fromInput, to: toInput });
  };

  if (!accessChecked) {
    return <div className="flex min-h-[50vh] items-center justify-center text-slate-200">Ładowanie...</div>;
  }

  if (!canView) {
    return (
      <Card className="border-red-500/20 bg-slate-950 text-white">
        <CardContent className="p-8 text-center text-lg font-medium">Brak dostępu</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 text-slate-100">
      <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5 shadow-2xl shadow-black/20 md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Kontrola raportowania</p>
            <h1 className="mt-2 text-3xl font-bold text-white">Raport tygodniowy PH</h1>
            <p className="mt-2 text-sm text-slate-400">Zakres raportu: {data?.from || "—"} — {data?.to || "—"}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input type="date" value={fromInput} onChange={(e) => setFromInput(e.target.value)} className="border-slate-700 bg-slate-900 text-slate-100" />
            <Input type="date" value={toInput} onChange={(e) => setToInput(e.target.value)} className="border-slate-700 bg-slate-900 text-slate-100" />
            <Button onClick={handleShow} disabled={isFetching} className="bg-emerald-600 text-white hover:bg-emerald-500">{isFetching ? "Ładowanie..." : "Pokaż"}</Button>
          </div>
        </div>
        {formError && <p className="mt-3 text-sm text-red-300">{formError}</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <WeeklyTotalsCard label="Spotkania umówione" value={data?.totals?.meetings_assigned ?? "—"} icon={CalendarRange} />
        <WeeklyTotalsCard label="Raporty" value={data?.totals?.meeting_reports ?? "—"} icon={FileText} />
        <WeeklyTotalsCard label="% pokrycia" value={data?.totals?.report_coverage_pct === null || data?.totals?.report_coverage_pct === undefined ? "—" : `${data.totals.report_coverage_pct}%`} icon={BarChart3} valueClassName={coverageColor(data?.totals?.report_coverage_pct)} />
        <WeeklyTotalsCard label="Telefony" value={data?.totals?.phone_assigned ?? "—"} icon={PhoneCall} />
      </div>

      {isLoading ? (
        <Card className="border-slate-800 bg-slate-950 text-slate-100"><CardContent className="p-8 text-center">Ładowanie raportu...</CardContent></Card>
      ) : error ? (
        <Card className="border-red-500/20 bg-slate-950 text-red-200"><CardContent className="p-8 text-center">Nie udało się pobrać raportu.</CardContent></Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-slate-300">
            <Users className="h-5 w-5" />
            <h2 className="text-lg font-semibold text-white">Struktury</h2>
          </div>
          {(data?.structures || []).map((structure) => (
            <WeeklyStructureCard key={structure.name} structure={structure} />
          ))}
          {(!data?.structures || data.structures.length === 0) && (
            <Card className="border-slate-800 bg-slate-950 text-slate-400"><CardContent className="p-8 text-center">Brak danych w wybranym zakresie.</CardContent></Card>
          )}
        </div>
      )}
    </div>
  );
}