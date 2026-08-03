import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import useCurrentUser from "@/components/shared/useCurrentUser";
import { fetchAllEntityRecords } from "@/lib/fetchAllEntityRecords";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Package } from "lucide-react";

function toDay(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return d.toISOString().split("T")[0];
}

export default function PackageAssignmentReport() {
  const { currentUser, accessChecked } = useCurrentUser();
  const [mode, setMode] = useState("user"); // user | group
  const defaultFrom = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);

  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "hr_admin";
  const isGroupLeader = currentUser?.role === "group_leader";

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["assignment-report-leads"],
    queryFn: () => fetchAllEntityRecords(base44.entities.ContactLead),
    enabled: accessChecked && (isAdmin || isGroupLeader),
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: () => base44.entities.Group.list(),
    enabled: accessChecked && (isAdmin || isGroupLeader),
  });

  const groupName = (id) => groups.find(g => g.id === id)?.name || "Bez grupy";

  const rows = useMemo(() => {
    let assigned = leads.filter(l => l.assigned_user_email);
    if (isGroupLeader && currentUser?.groupId) {
      assigned = assigned.filter(l => l.group_id === currentUser.groupId);
    }
    const from = dateFrom || "0000-00-00";
    const to = dateTo || "9999-99-99";
    const map = {};
    assigned.forEach(l => {
      const day = toDay(l.assigned_at || l.updated_date);
      if (!day || day < from || day > to) return;
      const key = mode === "user"
        ? `${day}__${l.assigned_user_email}`
        : `${day}__${l.group_id || ""}`;
      if (!map[key]) {
        map[key] = {
          day,
          label: mode === "user"
            ? (l.assigned_user_name || l.assigned_user_email)
            : groupName(l.group_id),
          sub: mode === "user" ? l.assigned_user_email : "",
          count: 0,
        };
      }
      map[key].count += 1;
    });
    return Object.values(map).sort((a, b) =>
      b.day.localeCompare(a.day) || b.count - a.count
    );
  }, [leads, mode, dateFrom, dateTo, isGroupLeader, currentUser, groups]);

  const totals = useMemo(() => {
    const map = {};
    rows.forEach(r => {
      const key = r.sub || r.label;
      if (!map[key]) map[key] = { label: r.label, sub: r.sub, count: 0 };
      map[key].count += r.count;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [rows]);

  const grandTotal = rows.reduce((acc, r) => acc + r.count, 0);

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
        title="Raport przypisań z paczek kontaktów"
        subtitle="Kiedy i ile kontaktów zostało przypisanych do handlowca lub grupy"
      />

      {/* Filtry */}
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Od</label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-10 w-40" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Do</label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-10 w-40" />
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={mode === "user" ? "default" : "outline"}
            onClick={() => setMode("user")}
            className={`h-10 gap-1.5 ${mode === "user" ? "bg-green-600 hover:bg-green-700 text-white" : ""}`}
          >
            <Users className="w-4 h-4" /> Wg handlowca
          </Button>
          <Button
            size="sm"
            variant={mode === "group" ? "default" : "outline"}
            onClick={() => setMode("group")}
            className={`h-10 gap-1.5 ${mode === "group" ? "bg-green-600 hover:bg-green-700 text-white" : ""}`}
          >
            <Package className="w-4 h-4" /> Wg grupy
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Podsumowanie */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs font-semibold text-gray-400 uppercase mb-3">
              Podsumowanie okresu — łącznie {grandTotal} przypisań
            </div>
            {totals.length === 0 ? (
              <div className="text-sm text-gray-400">Brak przypisań w wybranym okresie</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {totals.map(t => (
                  <div key={t.sub || t.label} className="inline-flex items-center gap-2 bg-green-50 border border-green-100 rounded-full px-3 py-1">
                    <span className="text-xs font-medium text-green-800">{t.label}</span>
                    <span className="rounded-full bg-green-600 text-white px-1.5 py-0.5 text-[10px] font-bold leading-none">{t.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tabela dzień po dniu */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[110px_1fr_80px] gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <span>Data</span>
              <span>{mode === "user" ? "Handlowiec" : "Grupa"}</span>
              <span className="text-right">Kontakty</span>
            </div>
            {rows.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">Brak danych w wybranym okresie</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {rows.map((r, i) => (
                  <div key={i} className="grid grid-cols-[110px_1fr_80px] gap-3 px-4 py-2.5 items-center text-sm">
                    <span className="text-gray-600">{new Date(r.day).toLocaleDateString("pl-PL")}</span>
                    <div className="min-w-0">
                      <div className="text-gray-900 font-medium truncate">{r.label}</div>
                      {r.sub && <div className="text-xs text-gray-400 truncate">{r.sub}</div>}
                    </div>
                    <span className="text-right font-bold text-green-700">{r.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-xs text-gray-400">
            Dla kontaktów przypisanych przed wprowadzeniem raportu data przypisania jest przybliżona (data ostatniej zmiany kontaktu).
          </p>
        </>
      )}
    </div>
  );
}