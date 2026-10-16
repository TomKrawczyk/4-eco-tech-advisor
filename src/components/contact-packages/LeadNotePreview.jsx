import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { StickyNote } from "lucide-react";

// Kompaktowe żółte karteczki z notatkami kontaktu — widoczne pod zwiniętym kontaktem.
export default function LeadNotePreview({ leadId, className = "" }) {
  const { data } = useQuery({
    queryKey: ["lead-notes", leadId],
    queryFn: async () => {
      const res = await base44.entities.ContactNote.filter(
        { lead_id: leadId },
        { sort: "-created_date", limit: 10 }
      );
      return res.items || res || [];
    },
    enabled: !!leadId,
    staleTime: 60 * 1000,
  });

  const notes = data || [];
  if (notes.length === 0) return null;

  return (
    <div className={`flex flex-col gap-1 max-w-full ${className}`}>
      {notes.map((n) => (
        <div
          key={n.id}
          className="rounded px-1.5 py-0.5 text-[11px] leading-tight text-gray-800"
          style={{ backgroundColor: "#FEFFB3" }}
        >
          <div className="flex items-center gap-1 text-yellow-900/80">
            <StickyNote className="w-2.5 h-2.5 shrink-0" />
            <span className="font-medium truncate">{n.author_name || n.author_email}</span>
          </div>
          <div className="mt-0.5 line-clamp-2">{n.content}</div>
        </div>
      ))}
    </div>
  );
}