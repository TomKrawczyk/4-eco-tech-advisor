import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { StickyNote, Trash2, Plus } from "lucide-react";

const LEADER_ROLES = ["admin", "group_leader", "structure_director"];

// Podświetla adresy e-mail w treści na zielono (#8ABF67)
function renderContent(text) {
  if (!text) return null;
  const parts = text.split(/([^ ]+@[^ ]+\.[^ ]+)/g);
  return parts.map((p, i) =>
    /^[^ ]+@[^ ]+\.[^ ]+$/.test(p)
      ? <span key={i} style={{ color: "#8ABF67" }}>{p}</span>
      : <span key={i}>{p}</span>
  );
}

function fmtDate(iso) {
  try {
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return iso || "";
  }
}

export default function LeadNotesTimeline({ lead, currentUser }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const leadId = lead?.id;

  const canManage =
    !!currentUser &&
    (LEADER_ROLES.includes(currentUser.role) || lead?.assigned_user_email === currentUser.email);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["lead-notes", leadId],
    queryFn: async () => {
      const res = await base44.entities.ContactNote.filter(
        { lead_id: leadId },
        { sort: "-created_date", limit: 200 }
      );
      return res.items || res || [];
    },
    enabled: !!leadId,
  });

  const addMutation = useMutation({
    mutationFn: async (content) =>
      base44.entities.ContactNote.create({
        lead_id: leadId,
        package_id: lead?.package_id || "",
        group_id: lead?.group_id || "",
        assigned_user_email: lead?.assigned_user_email || currentUser.email,
        author_email: currentUser.email,
        author_name: currentUser.displayName || currentUser.full_name || currentUser.email,
        content,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-notes", leadId] });
      qc.invalidateQueries({ queryKey: ["latest-note", leadId] });
      setText("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ContactNote.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-notes", leadId] });
      qc.invalidateQueries({ queryKey: ["latest-note", leadId] });
    },
  });

  const handleAdd = () => {
    const t = text.trim();
    if (!t) return;
    addMutation.mutate(t);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">
        <StickyNote className="w-3.5 h-3.5 text-yellow-500" />
        Notatki ({notes.length})
      </div>

      {isLoading ? (
        <div className="text-xs text-gray-400">Wczytywanie notatek...</div>
      ) : notes.length === 0 ? (
        <div className="text-xs text-gray-400 italic">Brak notatek. Dodaj pierwszą, żeby szybciej wracać do kontaktu.</div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {notes.map((n) => {
            const canDel =
              canManage &&
              (n.author_email === currentUser.email || LEADER_ROLES.includes(currentUser.role));
            return (
              <div
                key={n.id}
                className="relative rounded-lg p-3 text-sm leading-snug shadow-sm"
                style={{ backgroundColor: "#FEFFB3" }}
              >
                <div className="text-[10px] text-gray-700 font-mono">{fmtDate(n.created_date)}</div>
                <div className="text-xs font-semibold text-gray-900 mt-0.5">
                  {n.author_name || n.author_email}
                </div>
                <div className="mt-1 whitespace-pre-wrap text-gray-900 text-[13px]">
                  {renderContent(n.content)}
                </div>
                {canDel && (
                  <button
                    onClick={() => deleteMutation.mutate(n.id)}
                    className="absolute top-2 right-2 text-gray-500 hover:text-red-500 transition-colors"
                    title="Usuń notatkę"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {canManage && (
        <div className="flex gap-2 items-end pt-1">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder="Dodaj notatkę do kontaktu..."
            className="flex-1 rounded-lg border border-yellow-300 bg-yellow-50/40 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-yellow-300"
          />
          <button
            onClick={handleAdd}
            disabled={addMutation.isPending || !text.trim()}
            className="px-3 py-2 rounded-lg text-sm font-medium bg-yellow-400 hover:bg-yellow-500 text-black disabled:opacity-50 inline-flex items-center gap-1 transition-colors"
          >
            <Plus className="w-4 h-4" /> Dodaj
          </button>
        </div>
      )}
    </div>
  );
}