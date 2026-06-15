import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Download, FileText, PhoneCall, Users } from "lucide-react";
import { base44 } from "@/api/base44Client";
import useCurrentUser from "@/components/shared/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import WeeklyTotalsCard from "@/components/weekly-report/WeeklyTotalsCard";
import WeeklyPhoneStructureCard from "@/components/weekly-report/WeeklyPhoneStructureCard";
import { downloadWeeklyPhoneContactsExcel } from "@/lib/weeklyPhoneContactsExcel";

function coverageColor(value) {
  if (value === null || value === undefined) return "text-slate-800";
  if (value >= 80) return "text-green-700";
  if (value >= 50) return "text-amber-700";
  return "text-red-700";
}

export default function KontaktyTelefoniczne() {
  const { currentUser, accessChecked } = useCurrentUser();
  const { toast } = useToast();
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [range, setRange] = useState({ from: "", to: "" });
  const [formError, setFormError] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const canView = currentUser?.role === "admin" || currentUser?.role === "owner";

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["weeklyStructureReport", "phones", range.from || "default", range.to || "default"],
    queryFn: async () => {
      const payload = range.from && range.to ? { from: range.from, to: range.to } : {};
      const response = await base44.functions.invoke("weeklyStructureReport", payload);
      return response.data;
    },
    enabled: accessChecked && canView,
  });

  const structures = useMemo(() => {
    return (data?.structures || []).filter((structure) => (structure?.metrics?.phone_contacts_assigned ?? 0) > 0);
  }, [data]);

  const handleShow = () => {
    if ((fromInput && !toInput) || (!fromInput && toInput)) {
      setFormError("Uzupełnij obie daty.");
      return;
    }
    setFormError("");
    setRange({ from: fromInput, to: toInput });
  };

  const handleExport = async () => {
    const currentFrom = data?.from || range.from || fromInput;
    const currentTo = data?.to || range.to || toInput;

    if ((currentFrom && !currentTo) || (!currentFrom && currentTo)) {
      setFormError("Uzupełnij obie daty.");
      return;
    }

    setFormError("");
    setIsExporting(true);

    try {
      const rows = structures.flatMap((structure) =>
        (structure?.phone_contacts || []).map((contact) => ({
          struktura: structure?.name || "Bez struktury",
          klient: contact?.client_name || "",
          telefon: contact?.client_phone || "",
          data: contact?.contact_date || "",
          doradca: contact?.advisor_name || "— nieprzypisany —",
          doradca_email: contact?.advisor_email || "",
          adres: contact?.client_address || "",
          status_raportu: contact?.report_status || "",
          zaraportowano: contact?.reported ? "TAK" : "NIE",
        }))
      );

      downloadWeeklyPhoneContactsExcel(rows, currentFrom || data?.from, currentTo || data?.to);
      toast({ title: "Eksport gotowy", description: "Plik Excel został pobrany." });
    } catch (_) {
      toast({ title: "Błąd eksportu", description: "Nie udało się pobrać pliku Excel." });
    } finally {
      setIsExporting(false);
    }
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
            <h1 className="mt-2 text-3xl font-bold text-slate-800">Kontakty telefoniczne</h1>
            <p className="mt-2 text-sm text-gray-500">Zakres raportu: {data?.from || "—"} — {data?.to || "—"}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Input type="date" value={fromInput} onChange={(e) => setFromInput(e.target.value)} className="border-gray-200 bg-white text-slate-800" />
            <Input type="date" value={toInput} onChange={(e) => setToInput(e.target.value)} className="border-gray-200 bg-white text-slate-800" />
            <Button onClick={handleShow} disabled={isFetching || isExporting} className="bg-green-600 text-white hover:bg-green-700">
              {isFetching ? "Ładowanie..." : "Pokaż"}
            </Button>
            <Button onClick={handleExport} disabled={isExporting || isFetching || isLoading} className="bg-green-600 text-white hover:bg-green-700">
              <Download className="mr-2 h-4 w-4" />
              {isExporting ? "Eksportuję..." : "Eksportuj do Excela"}
            </Button>
          </div>
        </div>
        {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <WeeklyTotalsCard label="Łączna liczba kontaktów" value={data?.totals?.phone_contacts_assigned ?? "—"} icon={PhoneCall} />
        <WeeklyTotalsCard label="Zaraportowane" value={data?.totals?.phone_contacts_reported ?? "—"} icon={FileText} />
        <WeeklyTotalsCard label="Bez raportu" value={data?.totals?.phone_contacts_missing ?? "—"} icon={Users} />
        <WeeklyTotalsCard label="Pokrycie" value={data?.totals?.phone_contacts_coverage_pct === null || data?.totals?.phone_contacts_coverage_pct === undefined ? "—" : `${data.totals.phone_contacts_coverage_pct}%`} icon={BarChart3} valueClassName={coverageColor(data?.totals?.phone_contacts_coverage_pct)} />
      </div>

      {isLoading ? (
        <Card className="rounded-xl border border-gray-200 bg-white text-slate-700 shadow-sm"><CardContent className="p-8 text-center">Ładowanie kontaktów...</CardContent></Card>
      ) : error ? (
        <Card className="rounded-xl border border-red-200 bg-white text-red-700 shadow-sm"><CardContent className="p-8 text-center">Nie udało się pobrać kontaktów telefonicznych.</CardContent></Card>
      ) : structures.length === 0 ? (
        <Card className="rounded-xl border border-gray-200 bg-white text-gray-500 shadow-sm"><CardContent className="p-8 text-center">Brak kontaktów telefonicznych w wybranym okresie.</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {structures.map((structure) => (
            <WeeklyPhoneStructureCard key={structure.name} structure={structure} />
          ))}
        </div>
      )}
    </div>
  );
}