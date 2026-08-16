import React from "react";
import { getLeadStatusDate } from "@/components/contact-packages/leadExpiry";

const STATUS_LABELS = {
  not_interested: "Niezainteresowany",
  no_answer: "Brak odpowiedzi",
  wrong_number: "Błędny numer",
};

const STATUS_COLORS = {
  not_interested: "bg-red-50 text-red-700",
  no_answer: "bg-gray-100 text-gray-600",
  wrong_number: "bg-rose-50 text-rose-700",
};

export default function HiddenLeadRow({ lead, packageName }) {
  const statusDate = getLeadStatusDate(lead);

  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-gray-900">{lead.client_name}</div>
          <div className="text-sm text-gray-500 break-words">
            {lead.client_phone}
            {lead.postal_code ? ` · ${lead.postal_code}` : ""}
            {lead.client_address ? ` · ${lead.client_address}` : ""}
          </div>
        </div>
        <span className={`shrink-0 text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[lead.status] || "bg-gray-50 text-gray-600"}`}>
          {STATUS_LABELS[lead.status] || lead.status}
        </span>
      </div>
      <div className="mt-2 grid gap-0.5 text-xs text-gray-500">
        {packageName && <span>Paczka: {packageName}</span>}
        <span>Handlowiec: {lead.assigned_user_name || lead.assigned_user_email || "— brak —"}</span>
        <span>Zmiana statusu: {statusDate ? new Date(statusDate).toLocaleString("pl-PL") : "—"}</span>
        {lead.contact_notes && <span className="text-gray-600">Notatka: {lead.contact_notes}</span>}
      </div>
    </div>
  );
}