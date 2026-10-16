import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import useCurrentUser from "@/components/shared/useCurrentUser";
import { fetchAllEntityRecords } from "@/lib/fetchAllEntityRecords";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Calendar, Package } from "lucide-react";
import { isHiddenFromAdvisor } from "@/components/contact-packages/leadExpiry";
import exportQuarterlyReport from "@/components/contact-packages/exportQuarterlyReport";

const STATUS_LABELS = {
  unassigned: "Nieprzypisany", assigned: "Przypisany", contacted: "Skontaktowany",
  interested: "Zainteresowany", not_interested: "Niezainteresowany", no_answer: "Brak odpowiedzi",
  wrong_number: "Błędny numer", callback: "Do ponownego kontaktu", meeting_scheduled: "Spotkanie umówione",
  offer_submitted: "Złożona oferta", contract_signed: "Umowa podpisana", withdrawn: "Odstąpienie",
  no_pv_install: "Brak instalacji PV", other_ph_contact: "Kontakt z inną strukturą",
};

function quarterRange(year, q) {
  const months = [[0, 2], [3, 5], [6, 8], [9, 11]][q - 1];
  const from = new Date(year, months[0], 1).toISOString().split("T")[0];
  const to = new Date(year, months[1] + 1, 0).toISOString().split("T")[0];
  return { from, to };
}

function toDay(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d) ? null : d.toISOString().split("T")[0];
}

export default function PackageQuarterlyReport() {
  const { currentUser, accessChecked } = useCurrentUser();
  const now = new Date();
  const currentQ = Math.floor(now.getMonth() / 3) + 1;
  const initRange = quarterRange(now.getFullYear(), currentQ);
  const [dateFrom, setDateFrom] = useState(initRange.from);
  const [dateTo, setDateTo] = useState(initRange.to);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "hr_admin";
  const isGroupLeader = currentUser?.role === "group_leader";

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["quarterly-leads"],
    queryFn: () => fetchAllEntityRecords(base44.entities.ContactLead),
    enabled: accessChecked && (isAdmin || isGroupLeader),
  });

  const { data: packages = [] } = useQuery({
    queryKey: ["quarterly-packages"],
    queryFn: () => fetchAllEntityRecords(base44.entities.ContactPackage),
    enabled: accessChecked && (isAdmin || isGroupLeader),
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: () => base44.entities.Group.list(),
    enabled: accessChecked && (isAdmin || isGroupLeader),
  });

  const groupName = (id) => groups.find((g) => g.id === id)?.name || "Bez grupy";

  // Filtr: kontakt należy do okresu, gdy data przypisania LUB data importu wpada w zakres.
  // Uwzględniamy też kontakty zarchiwizowane i wygasłe.
  const filtered = useMemo(() => {
    const from = dateFrom || "0000-00-00";
    const to = dateTo || "9999-99-99";
    let list = leads.filter((l) => {
      const day = toDay(l.assigned_at) || toDay(l.created_date);
      return day && day >= from && day <= to;
    });
    if (isGroupLeader && currentUser?.groupId) {
      list = list.filter((l) => l.group_id === currentUser.groupId);
    }
    return list;
  }, [leads, dateFrom, dateTo, isGroupLeader, currentUser]);

  const pkgName = (id) => packages.find((p) => p.id === id)?.name || "—";
  const pkgGroupName = (id) => {
    const p = packages.find((p) => p.id === id);
    if (!p) return "—";
    return groups.find((g) => g.id === p.group_id)?.name || "Bez grupy";
  };

  const byGroup = useMemo(() => {
    const map = {};
    filtered.forEach((l) => {
      const g = groupName(l.group_id);
      if (!map[g]) map[g] = { total: 0, assigned: 0, archived: 0, expired: 0, movedGroup: 0, byStatus: {} };
      map[g].total += 1;
      if (l.assigned_user_email) map[g].assigned += 1;
      if (l.is_archived) map[g].archived += 1;
      if (isHiddenFromAdvisor(l)) map[g].expired += 1;
      // Paczka przeniesiona do innej grupy: grupa leada ≠ obecna grupa paczki
      const pCur = packages.find((p) => p.id === l.package_id);
      if (pCur && pCur.group_id && pCur.group_id !== l.group_id) map[g].movedGroup += 1;
      const st = STATUS_LABELS[l.status] || l.status || "Inny";
      map[g].byStatus[st] = (map[g].byStatus[st] || 0) + 1;
    });
    return Object.entries(map)
      .map(([group, v]) => ({ group, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [filtered, groups, packages]);

  const statusKeys = useMemo(
    () => Array.from(new Set(byGroup.flatMap((g) => Object.keys(g.byStatus)))).sort(),
    [byGroup]
  );

  const grandTotal = filtered.length;

  const setQuarter = (q) => {
    const r = quarterRange(selectedYear, q);
    setDateFrom(r.from);
    setDateTo(r.to);
  };

  const handleExport = () => {
    exportQuarterlyReport({ leads: filtered, packages, groups, dateFrom, dateTo });
  };

  if (!accessChecked) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-7 h-7 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin && !isGroupLeader) {
    return <div className="text-center py-16 text-gray-500">Brak dostępu do tego raportu.</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Raport kwartalny paczek kontaktów"
        subtitle="Pełny obraz kontaktów z paczek w wybranym okresie — łącznie z wygasłymi, zarchiwizowanymi i paczkami przeniesionymi do innej grupy"
      />

      {/* Filtry okresu */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Od</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-10 w-44" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Do</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-10 w-44" />
          </div>
          <div className="flex items-end gap-1">
            <label className="text-xs text-gray-500 block mb-1 mr-1">Rok</label>
            <Input
              type="number"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value) || now.getFullYear())}
              className="h-10 w-24"
            />
          </div>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((q) => (
              <Button
                key={q}
                size="sm"
                variant="outline"
                onClick={() => setQuarter(q)}
                className="h-10"
              >
                Q{q}
              </Button>
            ))}
          </div>
          <Button
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="h-10 gap-1.5 bg-green-600 hover:bg-green-700 text-white ml-auto"
          >
            <Download className="w-4 h-4" /> Eksport do Excela
          </Button>
        </div>
        <p className="text-xs text-gray-400 flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          Okres: {dateFrom} – {dateTo} · Łącznie {grandTotal} kontaktów
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : byGroup.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400">
          Brak kontaktów w wybranym okresie.
        </div>
      ) : (
        <>
          {/* Podsumowanie wg grupy */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" /> Podsumowanie wg grupy
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100">
                  <th className="text-left px-4 py-2 font-medium">Grupa</th>
                  <th className="text-right px-3 py-2 font-medium">Łącznie</th>
                  <th className="text-right px-3 py-2 font-medium">Przypisane</th>
                  <th className="text-right px-3 py-2 font-medium">Zarchiwizowane</th>
                  <th className="text-right px-3 py-2 font-medium">Wygasłe</th>
                  <th className="text-right px-3 py-2 font-medium">Przeniesione do innej grupy</th>
                  {statusKeys.map((s) => (
                    <th key={s} className="text-right px-3 py-2 font-medium whitespace-nowrap">{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byGroup.map((g) => (
                  <tr key={g.group} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{g.group}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-green-700">{g.total}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700">{g.assigned}</td>
                    <td className="px-3 py-2.5 text-right text-gray-500">{g.archived}</td>
                    <td className="px-3 py-2.5 text-right text-gray-500">{g.expired}</td>
                    <td className="px-3 py-2.5 text-right text-amber-600 font-medium">{g.movedGroup}</td>
                    {statusKeys.map((s) => (
                      <td key={s} className="px-3 py-2.5 text-right text-gray-600">{g.byStatus[s] || 0}</td>
                    ))}
                  </tr>
                ))}
                <tr className="bg-green-50 font-semibold">
                  <td className="px-4 py-2.5 text-gray-900">RAZEM</td>
                  <td className="px-3 py-2.5 text-right text-green-800">{grandTotal}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700">{byGroup.reduce((a, g) => a + g.assigned, 0)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-500">{byGroup.reduce((a, g) => a + g.archived, 0)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-500">{byGroup.reduce((a, g) => a + g.expired, 0)}</td>
                  <td className="px-3 py-2.5 text-right text-amber-700">{byGroup.reduce((a, g) => a + g.movedGroup, 0)}</td>
                  {statusKeys.map((s) => (
                    <td key={s} className="px-3 py-2.5 text-right text-gray-700">
                      {byGroup.reduce((a, g) => a + (g.byStatus[s] || 0), 0)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Lista paczek w okresie z oznaczeniem przeniesionych */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase">
              Paczki w okresie (z kontakty)
            </div>
            <div className="divide-y divide-gray-50 max-h-[420px] overflow-y-auto">
              {Array.from(new Set(filtered.map((l) => l.package_id))).map((pid) => {
                const p = packages.find((p) => p.id === pid);
                const pLeads = filtered.filter((l) => l.package_id === pid);
                const leadGroup = pLeads[0]?.group_id;
                const moved = p && p.group_id && p.group_id !== leadGroup;
                return (
                  <div key={pid} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate">{p?.name || "Usunięta paczka"}</div>
                      <div className="text-xs text-gray-400">
                        Grupa przypisania: {groupName(leadGroup)}
                        {moved && (
                          <span className="text-amber-600 font-medium"> · obecnie w: {pkgGroupName(pid)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {moved && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Przeniesiona</span>}
                      <span className="text-right font-bold text-green-700">{pLeads.length}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}