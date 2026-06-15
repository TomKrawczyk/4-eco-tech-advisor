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
  if (value === null || value === undefined) return "text-slate-800";
  if (value >= 70) return "text-green-700";
  if (value >= 30) return "text-amber-700";
  return "text-red-700";
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
    return <div className="flex min-h-[50vh] items-center justify-center text-slate-600">Ładowanie...</div>;
  }

  if (!canView) {
    return (
      <Card className="rounded-xl border border-red-200 bg-white text-slate-800 shadow-sm">
        <CardContent className="p-8 text-center text-lg font-medium">Brak dostępu</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 rounded-3xl bg-gradient-to-br from-green-50 via-emerald-50 to-white p-1 text-slate-800">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-green-700">Kontrola raportowania</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-800">Raport tygodniowy PH</h1>
            <p className="mt-2 text-sm text-gray-500">Zakres raportu: {data?.from || "—"} — {data?.to || "—"}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input type="date" value={fromInput} onChange={(e) => setFromInput(e.target.value)} className="border-gray-200 bg-white text-slate-800" />
            <Input type="date" value={toInput} onChange={(e) => setToInput(e.target.value)} className="border-gray-200 bg-white text-slate-800" />
            <Button onClick={handleShow} disabled={isFetching} className="bg-green-600 text-white hover:bg-green-700">{isFetching ? "Ładowanie..." : "Pokaż"}</Button>
          </div>
        </div>
        {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <WeeklyTotalsCard label="Spotkania umówione" value={data?.totals?.meetings_assigned ?? "—"} icon={CalendarRange} />
        <WeeklyTotalsCard label="Raporty" value={data?.totals?.meeting_reports ?? "—"} icon={FileText} />
        <WeeklyTotalsCard label="% pokrycia" value={data?.totals?.report_coverage_pct === null || data?.totals?.report_coverage_pct === undefined ? "—" : `${data.totals.report_coverage_pct}%`} icon={BarChart3} valueClassName={coverageColor(data?.totals?.report_coverage_pct)} />
        <WeeklyTotalsCard label="Telefony" value={data?.totals?.phone_assigned ?? "—"} icon={PhoneCall} />
      </div>

      {isLoading ? (
        <Card className="rounded-xl border border-gray-200 bg-white text-slate-700 shadow-sm"><CardContent className="p-8 text-center">Ładowanie raportu...</CardContent></Card>
      ) : error ? (
        <Card className="rounded-xl border border-red-200 bg-white text-red-700 shadow-sm"><CardContent className="p-8 text-center">Nie udało się pobrać raportu.</CardContent></Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-slate-700">
            <Users className="h-5 w-5 text-green-600" />
            <h2 className="text-lg font-semibold text-slate-800">Struktury</h2>
          </div>
          {(data?.structures || []).map((structure) => (
            <WeeklyStructureCard key={structure.name} structure={structure} />
          ))}
          {(!data?.structures || data.structures.length === 0) && (
            <Card className="rounded-xl border border-gray-200 bg-white text-gray-500 shadow-sm"><CardContent className="p-8 text-center">Brak danych w wybranym zakresie.</CardContent></Card>
          )}
        </div>
      )}
    </div>
  );
}