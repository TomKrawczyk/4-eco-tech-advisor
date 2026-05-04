import React from "react";
import { Badge } from "@/components/ui/badge";
import { Calendar, Phone, User, MapPin } from "lucide-react";

const typeLabels = {
  phone: "Kontakt telefoniczny",
  meeting: "Spotkanie",
  visit: "Wizyta",
  service: "Serwis",
};

const typeColors = {
  phone: "bg-green-50 text-green-700 border-green-200",
  meeting: "bg-blue-50 text-blue-700 border-blue-200",
  visit: "bg-purple-50 text-purple-700 border-purple-200",
  service: "bg-orange-50 text-orange-700 border-orange-200",
};

export default function AllReportCard({ report }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-semibold text-gray-900">{report.client_name || "Bez nazwy klienta"}</h3>
            <Badge variant="outline" className={typeColors[report.type]}>{typeLabels[report.type]}</Badge>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            {report.date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(report.date).toLocaleDateString("pl-PL")}</span>}
            {report.client_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{report.client_phone}</span>}
            {report.client_address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{report.client_address}</span>}
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 text-sm">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs font-semibold text-gray-400 uppercase mb-1">Przypisany handlowiec</div>
          <div className="flex items-center gap-2 text-gray-800">
            <User className="w-4 h-4 text-green-600" />
            <span>{report.assigned_user_name || report.assigned_user_email || "Brak przypisania"}</span>
          </div>
          {report.assigned_user_email && <div className="text-xs text-gray-400 mt-1">{report.assigned_user_email}</div>}
        </div>

        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs font-semibold text-gray-400 uppercase mb-1">Autor raportu</div>
          <div className="text-gray-800">{report.author_name || report.author_email || "—"}</div>
          {report.author_email && <div className="text-xs text-gray-400 mt-1">{report.author_email}</div>}
        </div>
      </div>

      {(report.resultLabel || report.description || report.next_steps) && (
        <div className="mt-3 border-t border-gray-100 pt-3 space-y-2 text-sm">
          {report.resultLabel && <Badge className="bg-gray-100 text-gray-700 border-gray-200">{report.resultLabel}</Badge>}
          {report.description && <p className="text-gray-700 whitespace-pre-wrap">{report.description}</p>}
          {report.next_steps && <p className="text-blue-700 whitespace-pre-wrap">→ {report.next_steps}</p>}
        </div>
      )}
    </div>
  );
}