import React from "react";
import { Badge } from "@/components/ui/badge";

const RESULT_LABELS = {
  interested: "Zainteresowany",
  not_interested: "Niezainteresowany",
  no_answer: "Brak odpowiedzi",
  callback: "Do oddzwonienia",
  meeting_scheduled: "Spotkanie umówione",
  other: "Raport złożony",
};

const RESULT_COLORS = {
  interested: "bg-green-50 text-green-700 border-green-200",
  not_interested: "bg-red-50 text-red-700 border-red-200",
  no_answer: "bg-gray-100 text-gray-600 border-gray-200",
  callback: "bg-purple-50 text-purple-700 border-purple-200",
  meeting_scheduled: "bg-purple-50 text-purple-700 border-purple-200",
  other: "bg-blue-50 text-blue-700 border-blue-200",
};

export default function ReportStatusBadge({ report }) {
  if (!report) return null;
  const label = RESULT_LABELS[report.result] || RESULT_LABELS.other;
  const color = RESULT_COLORS[report.result] || RESULT_COLORS.other;
  return (
    <Badge className={`${color} border text-[10px]`} title={report.description || ""}>
      📋 {label}
      {report.result === "callback" && report.callback_date
        ? ` (${new Date(report.callback_date).toLocaleDateString("pl-PL")})`
        : ""}
    </Badge>
  );
}