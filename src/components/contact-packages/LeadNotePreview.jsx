import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { MessageSquare } from "lucide-react";

// Podgląd najnowszej notatki z osi czasu w zwiniętym wierszu kontaktu.
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
    <div className={`flex items-center gap-1 min-w-0 ${className}`} title={data.content}>
      <MessageSquare className="w-3.5 h-3.5 text-green-600 shrink-0" />
      <span className="text-xs text-gray-500 truncate">{data.content}</span>
    </div>
  );
}