import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, User, MapPin, Phone, Clock, UserCheck, ChevronRight, MessageSquare } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import MeetingDetailModal from "./MeetingDetailModal";
import DetailsModal from "@/components/shared/DetailsModal";

export default function MeetingCard({ meeting, assignment, salespeople, assignmentsForDate, currentUserRole, meetingReports = [] }) {
  const [showDetail, setShowDetail] = useState(false);
  const [selectedDetails, setSelectedDetails] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const queryClient = useQueryClient();

  // Policz ile przypisań ma dany handlowiec w tym dniu
  const getAssignmentsCountForUserOnDate = (userEmail, date) => {
    return assignmentsForDate.filter(a => a.assigned_user_email === userEmail && a.meeting_date === date).length;
  };

  // Sprawdź czy raport po spotkaniu istnieje
  const existingReport = meetingReports.find(r => {
    const nameMatch = (r.client_name || '').toLowerCase().trim() === (meeting.client_name || '').toLowerCase().trim();
    const authorMatch = !assignment || r.author_email === assignment.assigned_user_email || r.created_by === assignment.assigned_user_email;
    return nameMatch && authorMatch;
  });

  const assignMutation = useMutation({
    mutationFn: async ({ userEmail, userName }) => {
      const key = `${meeting.sheet}__${meeting.client_name}__${meeting.meeting_calendar}`;
      if (assignment) {
        await base44.entities.MeetingAssignment.update(assignment.id, {
          assigned_user_email: userEmail,
          assigned_user_name: userName,
        });
      } else {
        await base44.entities.MeetingAssignment.create({
          meeting_key: key,
          sheet: meeting.sheet,
          client_name: meeting.client_name,
          meeting_calendar: meeting.meeting_calendar,
          meeting_date: meeting.meeting_date,
          assigned_user_email: userEmail,
          assigned_user_name: userName,
        });
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["meetingAssignments"] });
      toast.success("Przypisano handlowca");
      // Wyślij powiadomienie
      base44.functions.invoke("notifyMeetingAssigned", {
        assignedUserEmail: variables.userEmail,
        assignedUserName: variables.userName,
        clientName: meeting.client_name,
        meetingCalendar: meeting.meeting_calendar,
        sheet: meeting.sheet,
      }).catch(() => {});
    },
    onError: (e) => toast.error(e.message),
  });

  const unassignMutation = useMutation({
    mutationFn: async () => {
      if (assignment) await base44.entities.MeetingAssignment.delete(assignment.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetingAssignments"] });
      toast.success("Usunięto przypisanie");
    },
  });

  const canAssign = currentUserRole === "admin" || currentUserRole === "group_leader" || currentUserRole === "team_leader";

  return (
    <>
    <MeetingDetailModal
      meeting={showDetail ? meeting : null}
      assignment={assignment}
      existingReport={existingReport}
      onClose={() => setShowDetail(false)}
    />
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-green-200 hover:shadow-sm transition-all">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap cursor-pointer" onClick={() => setShowDetail(true)}>
            <User className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="font-semibold text-gray-900 text-sm hover:text-green-700 transition-colors">{meeting.client_name}</span>
            {existingReport && (
              <Badge className="bg-green-50 text-green-700 border-green-200 text-[10px]">✓ Raport</Badge>
            )}
            <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-medium">
              {meeting.sheet}
            </Badge>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-green-700 bg-green-50 rounded-md px-2 py-1 w-fit">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            {meeting.meeting_calendar}
          </div>

          {meeting.address && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              {meeting.address}
            </div>
          )}

          {meeting.phone && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <a href={`tel:${meeting.phone}`} className="hover:text-green-600 transition-colors">
                {meeting.phone}
              </a>
            </div>
          )}

          {meeting.agent && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              Agent: {meeting.agent}
            </div>
          )}

          {(meeting.agent || meeting.comments || meeting.interview_data) && (
            <button
              onClick={() => {
                setSelectedDetails({
                  agent: meeting.agent,
                  comments: meeting.comments,
                  interview_data: meeting.interview_data || {}
                });
                setDetailsModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors inline-flex items-center gap-1 mt-2"
            >
              <MessageSquare className="w-3 h-3" />
              Szczegóły
            </button>
          )}

          {/* Przypisanie handlowca */}
          {canAssign && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <UserCheck className="w-4 h-4 text-gray-400 shrink-0" />
              {assignment ? (
                <div className="flex items-center gap-2">
                  <Badge className="bg-violet-50 text-violet-700 border-violet-200 text-xs">
                    {assignment.assigned_user_name || assignment.assigned_user_email}
                  </Badge>
                  <button
                    onClick={() => unassignMutation.mutate()}
                    className="text-xs text-red-500 hover:underline"
                  >
                    usuń
                  </button>
                </div>
              ) : (
                <Select
                  onValueChange={(val) => {
                    const sp = salespeople.find(s => s.email === val);
                    const count = getAssignmentsCountForUserOnDate(val, meeting.meeting_date);
                    if (count >= 3) {
                      toast.error(`${sp?.name || val} ma już 3 spotkania tego dnia (maksimum)`);
                      return;
                    }
                    assignMutation.mutate({ userEmail: val, userName: sp?.name || val });
                  }}
                >
                  <SelectTrigger className="h-7 text-xs w-48">
                    <SelectValue placeholder="Przypisz handlowca..." />
                  </SelectTrigger>
                  <SelectContent>
                    {salespeople.map(sp => {
                      const count = getAssignmentsCountForUserOnDate(sp.email, meeting.meeting_date);
                      const full = count >= 3;
                      return (
                        <SelectItem key={sp.email} value={sp.email} disabled={full}>
                          <span className={full ? "text-red-400" : ""}>
                            {sp.name} {full ? `(max ${count}/3)` : count > 0 ? `(${count}/3)` : ""}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {!canAssign && assignment && (
            <Badge className="bg-violet-50 text-violet-700 border-violet-200 text-xs mt-1">
              <UserCheck className="w-3 h-3 mr-1" />
              {assignment.assigned_user_name || assignment.assigned_user_email}
            </Badge>
          )}
        </div>
        <button onClick={() => setShowDetail(true)} className="text-gray-400 hover:text-green-600 transition-colors self-start mt-1 shrink-0">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
    </>
  );
}