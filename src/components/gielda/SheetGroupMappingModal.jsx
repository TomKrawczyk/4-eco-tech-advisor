import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, Save, Loader2, Layers, Users } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { fetchAllEntityRecords } from "@/lib/fetchAllEntityRecords";

export default function SheetGroupMappingModal({ open, onClose, onSaved }) {
  const [sheets, setSheets] = useState([]);
  const [groups, setGroups] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(null);
  const [draft, setDraft] = useState({});

  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [pc, ma, gr, sga] = await Promise.all([
          fetchAllEntityRecords(base44.entities.PhoneContact),
          fetchAllEntityRecords(base44.entities.MeetingAssignment),
          fetchAllEntityRecords(base44.entities.Group),
          fetchAllEntityRecords(base44.entities.SheetGroupAssignment),
        ]);
        const sheetSet = new Set();
        for (const r of pc) { const s = String(r.sheet || "").trim(); if (s) sheetSet.add(s); }
        for (const r of ma) { const s = String(r.sheet || "").trim(); if (s) sheetSet.add(s); }
        const sheetList = Array.from(sheetSet).sort();
        const amap = {};
        for (const a of sga) {
          const sn = String(a.sheet_name || "").trim();
          if (sn) amap[sn] = { id: a.id, group_id: a.group_id || "", group_name: a.group_name || "" };
        }
        if (alive) {
          setSheets(sheetList);
          setGroups(gr);
          setAssignments(amap);
          setDraft({});
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [open]);

  const getGroupId = (s) => (draft[s] !== undefined ? draft[s] : (assignments[s]?.group_id || ""));

  const save = async (sheet) => {
    const groupId = getGroupId(sheet);
    setSaving(sheet);
    try {
      const existing = assignments[sheet];
      if (!groupId) {
        if (existing?.id) {
          await base44.entities.SheetGroupAssignment.delete(existing.id);
          setAssignments((prev) => { const n = { ...prev }; delete n[sheet]; return n; });
        }
      } else {
        const gname = groups.find((g) => g.id === groupId)?.name || "";
        if (existing?.id) {
          await base44.entities.SheetGroupAssignment.update(existing.id, { group_id: groupId, group_name: gname });
          setAssignments((prev) => ({ ...prev, [sheet]: { id: existing.id, group_id: groupId, group_name: gname } }));
        } else {
          const created = await base44.entities.SheetGroupAssignment.create({ sheet_name: sheet, group_id: groupId, group_name: gname });
          setAssignments((prev) => ({ ...prev, [sheet]: { id: created.id, group_id: groupId, group_name: gname } }));
        }
      }
      setDraft((prev) => { const n = { ...prev }; delete n[sheet]; return n; });
      onSaved?.();
    } finally {
      setSaving(null);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-green-600" />
            <h2 className="font-bold text-gray-900">Mapowanie arkuszy do grup</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-600" /></button>
        </div>
        <div className="p-3 text-xs text-gray-500 border-b bg-gray-50">
          Przypisz arkusz obdzwonki do grupy doradców. Arkusz <b>bez mapowania</b> jest widoczny dla całej giełdy.
          Arkusz <b>z mapowaniem</b> widzi tylko jego grupa (admin widzi wszystko).
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-green-600" /></div>
          ) : sheets.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">Brak arkuszy w rekordach PhoneContact / MeetingAssignment.</p>
          ) : (
            sheets.map((s) => {
              const current = assignments[s];
              const sel = getGroupId(s);
              const dirty = sel !== (current?.group_id || "");
              return (
                <div key={s} className="flex items-center gap-2 p-2 border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{s}</div>
                    {current?.group_name && (
                      <div className="text-[11px] text-gray-500 flex items-center gap-1">
                        <Users className="w-3 h-3" /> {current.group_name}
                      </div>
                    )}
                  </div>
                  <select
                    value={sel}
                    onChange={(e) => setDraft((prev) => ({ ...prev, [s]: e.target.value }))}
                    className="flex-1 max-w-[240px] text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white"
                  >
                    <option value="">— Widoczny dla wszystkich —</option>
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  <button
                    onClick={() => save(s)}
                    disabled={!dirty || saving === s}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-green-300 text-green-700 hover:bg-green-50 disabled:opacity-40"
                  >
                    {saving === s ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Zapisz
                  </button>
                </div>
              );
            })
          )}
        </div>
        <div className="px-4 py-3 border-t flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 rounded-lg">Gotowe</button>
        </div>
      </div>
    </div>,
    document.body
  );
}