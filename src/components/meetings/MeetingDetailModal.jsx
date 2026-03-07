import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Phone, User, Clock, ExternalLink, FileText, ClipboardList, MessageSquare, CheckSquare } from "lucide-react";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";

export default function MeetingDetailModal({ meeting, assignment, existingReport, onClose }) {
  if (!meeting) return null;

  // Buduj URL params z danymi spotkania
  const clientParams = new URLSearchParams({
    prefill_client_name: meeting.client_name || "",
    prefill_client_phone: meeting.phone || "",
    prefill_client_address: meeting.address || "",
    prefill_meeting_date: meeting.meeting_date || "",
    prefill_meeting_time: extractTime(meeting.meeting_calendar) || "",
    from_meeting: "1",
  }).toString();

  function extractTime(calStr) {
    if (!calStr) return "";
    const match = calStr.match(/(\d{1,2}):(\d{2})/);
    return match ? `${match[1].padStart(2, "0")}:${match[2]}` : "";
  }

  const actions = [
    {
      label: "Raport po spotkaniu",
      icon: FileText,
      color: "bg-green-600 hover:bg-green-700 text-white",
      page: "MeetingReports",
      desc: "Utwórz raport ze spotkania z klientem",
      done: !!existingReport,
    },
    {
      label: "Checklista techniczna",
      icon: CheckSquare,
      color: "bg-blue-600 hover:bg-blue-700 text-white",
      page: "Checklist",
      desc: "Uzupełnij checklistę doradcy technicznego",
    },
    {
      label: "Wywiad z klientem",
      icon: MessageSquare,
      color: "bg-violet-600 hover:bg-violet-700 text-white",
      page: "Interview",
      desc: "Przeprowadź wywiad z klientem",
    },
    {
      label: "Raport wizyty",
      icon: ClipboardList,
      color: "bg-orange-600 hover:bg-orange-700 text-white",
      page: "VisitReports",
      desc: "Stwórz szczegółowy raport wizyty",
    },
  ];

  return (
    <Dialog open={!!meeting} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-gray-500" />
            {meeting.client_name}
          </DialogTitle>
        </DialogHeader>

        {/* Dane klienta */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-green-700 font-semibold bg-green-50 rounded-lg px-3 py-2">
            <Calendar className="w-4 h-4 shrink-0" />
            {meeting.meeting_calendar}
          </div>
          {meeting.address && (
            <div className="flex items-center gap-2 text-gray-600">
              <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
              {meeting.address}
            </div>
          )}
          {meeting.phone && (
            <div className="flex items-center gap-2 text-gray-600">
              <Phone className="w-4 h-4 text-gray-400 shrink-0" />
              <a href={`tel:${meeting.phone}`} className="hover:text-green-600">{meeting.phone}</a>
            </div>
          )}
          {meeting.agent && (
            <div className="flex items-center gap-2 text-gray-500 text-xs">
              <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              Agent: {meeting.agent}
            </div>
          )}
          {assignment && (
            <div className="flex items-center gap-2">
              <Badge className="bg-violet-50 text-violet-700 border-violet-200 text-xs">
                Handlowiec: {assignment.assigned_user_name || assignment.assigned_user_email}
              </Badge>
            </div>
          )}
        </div>

        {/* Status raportu */}
        {existingReport && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-700 flex items-center gap-2">
            <CheckSquare className="w-4 h-4 shrink-0" />
            Raport po spotkaniu już istnieje
          </div>
        )}

        {/* Akcje */}
        <div className="space-y-2 pt-1">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Utwórz dokument</p>
          {actions.map(({ label, icon: Icon, color, page, desc, done }) => (
            <Link
              key={page}
              to={`${createPageUrl(page)}?${clientParams}`}
              onClick={onClose}
              className="block"
            >
              <div className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-all cursor-pointer ${
                done ? "bg-green-50 border border-green-200" : "bg-gray-50 hover:bg-gray-100 border border-gray-200"
              }`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  done ? "bg-green-500" : color.split(" ")[0]
                }`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800">{label}</div>
                  <div className="text-xs text-gray-500">{done ? "✓ Już uzupełniony" : desc}</div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
              </div>
            </Link>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}