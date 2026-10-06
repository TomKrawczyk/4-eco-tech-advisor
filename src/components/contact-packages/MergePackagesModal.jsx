import React, { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { X, GitMerge, Search, Users } from "lucide-react";

// Scalanie wielu paczek w jedną. Dostępne dla admina i lidera grupy.
// Wszystkie kontakty z paczek źródłowych zostają przeniesione do paczki docelowej.
export default function MergePackagesModal({ packages, stats, currentUser, onClose }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [targetId, setTargetId] = useState("");
  const [deleteSources, setDeleteSources] = useState(true);
  const [merging, setMerging] = useState(false);

  const isAdmin = currentUser?.role === "admin";

  const filtered = useMemo(
    () => packages.filter(p =>
      p.name?.toLowerCase().includes(search.toLowerCase()) &&
      p.status !== "archived"
    ),
    [packages, search]
  );

  const selectedPkgs = useMemo(
    () => packages.filter(p => selected.has(p.id)),
    [packages, selected]
  );

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (targetId === id) setTargetId("");
  };

  const totalLeadsToMerge = useMemo(
    () => selectedPkgs.reduce((sum, p) => sum + (stats[p.id]?.total ?? p.total_count ?? 0), 0),
    [selectedPkgs, stats]
  );

  const canMerge = selected.size >= 2 && targetId && !merging;

  const handleMerge = async () => {
    if (!canMerge) return;
    const target = packages.find(p => p.id === targetId);
    if (!target) return;
    const sources = selectedPkgs.filter(p => p.id !== targetId);
    if (sources.length === 0) {
      toast.error("Wybierz co najmniej dwie paczki i wskaż docelową.");
      return;
    }

    setMerging(true);
    try {
      let moved = 0;
      for (const src of sources) {
        const groupChanged = !!target.group_id && src.group_id !== target.group_id;
        const update = { package_id: target.id };
        if (target.group_id) update.group_id = target.group_id;
        // Jeśli paczka docelowa jest w innej grupie — czyścimy przypisania handlowców
        // (zgodnie z istniejącą logiką zmiany grupy paczki).
        if (groupChanged) {
          update.assigned_user_email = "";
          update.assigned_user_name = "";
          update.assigned_at = "";
        }
        const leads = await base44.entities.ContactLead.filter({ package_id: src.id });
        if (leads.length > 0) {
          await base44.entities.ContactLead.updateMany(
            { package_id: src.id },
            { $set: update }
          );
          moved += leads.length;
        }
      }

      // Przelicz liczniki paczki docelowej
      const targetLeads = await base44.entities.ContactLead.filter({ package_id: target.id });
      const activeTarget = targetLeads.filter(l => l.is_duplicate !== true && l.is_archived !== true);
      const assignedCount = activeTarget.filter(l => l.assigned_user_email).length;
      await base44.entities.ContactPackage.update(target.id, {
        total_count: activeTarget.length,
        assigned_count: assignedCount,
      });

      // Opcjonalne usunięcie pustych paczek źródłowych
      if (deleteSources) {
        for (const src of sources) {
          const remaining = await base44.entities.ContactLead.filter({ package_id: src.id });
          if (remaining.length === 0) {
            await base44.entities.ContactPackage.delete(src.id);
          } else {
            await base44.entities.ContactPackage.update(src.id, {
              total_count: remaining.filter(l => l.is_duplicate !== true && l.is_archived !== true).length,
              assigned_count: remaining.filter(l => l.assigned_user_email).length,
            });
          }
        }
      } else {
        // Przelicz liczniki paczek źródłowych (pozostawionych pustych)
        for (const src of sources) {
          await base44.entities.ContactPackage.update(src.id, {
            total_count: 0,
            assigned_count: 0,
          });
        }
      }

      toast.success(`Scalono ${sources.length} paczek do "${target.name}" — przeniesiono ${moved} kontaktów.`);
      qc.invalidateQueries({ queryKey: ["contact-packages"] });
      qc.invalidateQueries({ queryKey: ["contact-package-leads"] });
      qc.invalidateQueries({ queryKey: ["my-leads"] });
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Wystąpił błąd podczas scalania paczek.");
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-bold text-gray-900">Scal paczki</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-gray-100 space-y-3">
          <p className="text-sm text-gray-500">
            Zaznacz co najmniej dwie paczki, a następnie wskaż jedną jako docelową —
            wszystkie kontakty zostaną do niej przeniesione.
          </p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Szukaj paczki..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-2">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">Brak paczek do scalenia.</p>
          ) : filtered.map(pkg => {
            const isTarget = targetId === pkg.id;
            const isSelected = selected.has(pkg.id);
            const count = stats[pkg.id]?.total ?? pkg.total_count ?? 0;
            return (
              <label
                key={pkg.id}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  isTarget
                    ? "border-green-400 bg-green-50"
                    : isSelected
                    ? "border-green-200 bg-green-50/50"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(pkg.id)}
                  className="w-4 h-4 accent-green-600"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">{pkg.name}</div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{count}</span>
                    {pkg.group_name && <span className="text-green-600">{pkg.group_name}</span>}
                    {pkg.is_private && <span className="text-purple-600">Prywatna</span>}
                  </div>
                </div>
                {isSelected && (
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); setTargetId(isTarget ? "" : pkg.id); }}
                    className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                      isTarget
                        ? "bg-green-600 text-white border-green-600"
                        : "border-gray-300 text-gray-600 hover:border-green-400 hover:text-green-700"
                    }`}
                  >
                    {isTarget ? "Docelowa" : "Ustaw jako docelowa"}
                  </button>
                )}
              </label>
            );
          })}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 space-y-3">
          {selected.size > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">
                Zaznaczono: <strong className="text-gray-900">{selected.size}</strong> paczek
                {totalLeadsToMerge > 0 && (
                  <> · ~<strong className="text-gray-900">{totalLeadsToMerge}</strong> kontaktów</>
                )}
              </span>
              {targetId && (
                <span className="text-green-700">
                  Docelowa: <strong>{packages.find(p => p.id === targetId)?.name}</strong>
                </span>
              )}
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={deleteSources}
              onChange={e => setDeleteSources(e.target.checked)}
              className="w-4 h-4 accent-green-600"
            />
            Usuń puste paczki źródłowe po przeniesieniu kontaktów
          </label>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={onClose} disabled={merging}>Anuluj</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white gap-2"
              onClick={handleMerge}
              disabled={!canMerge}
            >
              <GitMerge className="w-4 h-4" />
              {merging ? "Scalanie..." : "Scal paczki"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}