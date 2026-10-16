import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { StickyNote } from "lucide-react";

// Kompaktowa żółta karteczka z najnowszą notatką — widoczna pod zwiniętym kontaktem.
export default function LeadNotePreview({ leadId, className = "" }) {
  const { data } = useQuery({
    queryKey: ["latest-note", leadId],
    queryFn: async () => {
      const res = await base44.entities.ContactNote.filter(
        { lead_id: leadId },
        { sort: "-created_date", limit: 1 }
      );
      return (res.items || res || [])[0] || null;
    },
    enabled: !!leadId,
    staleTime: 60 * 1000,
  });

  if (!data) return null;

  return (
    <div
      className={`inline-block max-w-full rounded px-1.5 py-0.5 text-[11px] leading-tight text-gray-800 ${className}`}
      style={{ backgroundColor: "#FEFFB3" }}
      title={data.content}
    >
      <div className="flex items-center gap-1 text-yellow-900/80">
        <StickyNote className="w-2.5 h-2.5 shrink-0" />
        <span className="font-medium truncate">{data.author_name || data.author_email}</span>
      </div>
      <div className="mt-0.5 line-clamp-2">{data.content}</div>
    </div>
  );
}