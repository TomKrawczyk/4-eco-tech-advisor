import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { StickyNote } from "lucide-react";

// Mała żółta karteczka z najnowszą notatką — widoczna pod zwiniętym kontaktem.
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
      className={`flex items-start gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-gray-800 leading-snug shadow-sm ${className}`}
      style={{ backgroundColor: "#FEFFB3" }}
      title={data.content}
    >
      <StickyNote className="w-3.5 h-3.5 mt-0.5 shrink-0 text-yellow-700" />
      <div className="min-w-0">
        <span className="font-medium text-yellow-900">{data.author_name || data.author_email}:</span>{" "}
        <span className="line-clamp-2">{data.content}</span>
      </div>
    </div>
  );
}