import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { Calendar, User, MapPin, Phone, Clock, UserCheck, ChevronRight, MessageSquare, Users } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import MeetingDetailModal from "./MeetingDetailModal";
import DetailsModal from "@/components/shared/DetailsModal";

// Parsuje "DD.MM.YYYY HH:MM" lub "YYYY-MM-DD HH:MM" -> { date: "YYYY-MM-DD", time: "HH:MM" }
function parseMeetingCalendar(str) {
  if (!str) return null;
  const match1 = str.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}:\d{2})/);
  if (match1) {
    const [, d, m, y, t] = match1;
    return { date: `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`, time: t };
  }
  const match2 = str.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}:\d{2})/);
  if (match2) {
    const [, y, m, d, t] = match2;
    return { date: `${y}-${m}-${d}`, time: t };
  }
  return null;
}

export default function MeetingCard({ meeting, assignment, salespeople, assignmentsForDate, currentUserRole, meetingReports = [], groups = [] }) {
  const [showDetail, setShowDetail] = useState(false);
  const [selectedDetails, setSelectedDetails] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [overloadConfirm, setOverloadConfirm] = useState(null); // { userEmail, userName, count }
  const queryClient = useQueryClient();

  const getAssignmentsCountForUserOnDate = (userEmail, date) => {
    return assignmentsForDate.filter(a => a.assigned_user_email === userEmail && a.meeting_date === date).length;
  };

  const existingReport = meetingReports.find(r => {
    const nameMatch = (r.client_name || '').toLowerCase().trim() === (meeting.client_name || '').toLowerCase().trim();
    const authorMatch = !assignment || r.author_email === assignment.assigned_user_email || r.created_by === assignment.assigned_user_email;
    return nameMatch && authorMatch;
  });

  const canAssign = currentUserRole === "admin" || currentUserRole === "group_leader" || currentUserRole === "team_leader";
  const canManageGroups = currentUserRole === "admin" || currentUserRole === "group_leader";

  const assignGroupMutation = useMutation({
    mutationFn: async ({ groupId, groupName }) => {
      const key = `${meeting.sheet}__${meeting.client_name}__${meeting.meeting_calendar}`;
      if (assignment) {
        await base44.entities.MeetingAssignment.update(assignment.id, {
          assigned_group_id: groupId,
          assigned_group_name: groupName,
        });
      } else {
        await base44.entities.MeetingAssignment.create({
          meeting_key: key,
          sheet: meeting.sheet,
          client_name: meeting.client_name,
          client_phone: meeting.phone || "",
          client_address: meeting.address || "",
          meeting_calendar: meeting.meeting_calendar,
          meeting_date: meeting.meeting_date,
          assigned_group_id: groupId,
          assigned_group_name: groupName,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetingAssignments"] });
      toast.success("Przypisano spotkanie do grupy");
    },
    onError: (e) => toast.error(e.message),
  });

  const unassignGroupMutation = useMutation({
    mutationFn: async () => {
      if (!assignment) return;
      await base44.entities.MeetingAssignment.update(assignment.id, {
        assigned_group_id: null,
        assigned_group_name: null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetingAssignments"] });
      toast.success("Usunięto przypisanie grupy");
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ userEmail, userName }) => {
      const key = `${meeting.sheet}__${meeting.client_name}__${meeting.meeting_calendar}`;
      const contactData = {
        client_phone: meeting.phone || assignment?.client_phone || "",
        client_address: meeting.address || assignment?.client_address || "",
        agent: meeting.agent || assignment?.agent || "",
        comments: meeting.comments || assignment?.comments || "",
      };

      // Zapis przypisania i synchronizacja kalendarza – równolegle
      const parsed = parseMeetingCalendar(meeting.meeting_calendar);

      const [, existingEvents] = await Promise.all([
        assignment
          ? base44.entities.MeetingAssignment.update(assignment.id, {
              assigned_user_email: userEmail,
              assigned_user_name: userName,
              ...contactData,
            })
          : base44.entities.MeetingAssignment.create({
              meeting_key: key,
              sheet: meeting.sheet,
              client_name: meeting.client_name,
              meeting_calendar: meeting.meeting_calendar,
              meeting_date: meeting.meeting_date,
              assigned_user_email: userEmail,
              assigned_user_name: userName,
              ...contactData,
            }),
        parsed
          ? base44.entities.CalendarEvent.filter({ meeting_assignment_id: key })
          : Promise.resolve([]),
      ]);

      if (parsed) {
        const eventData = {
          title: `Spotkanie: ${meeting.client_name}`,
          description: `Arkusz: ${meeting.sheet}${(meeting.address || assignment?.client_address) ? `\nAdres: ${meeting.address || assignment?.client_address}` : ""}${(meeting.phone || assignment?.client_phone) ? `\nTel: ${meeting.phone || assignment?.client_phone}` : ""}`,
          event_date: parsed.date,
          event_time: parsed.time,
          event_type: "meeting",
          status: "planned",
          client_name: meeting.client_name,
          client_phone: meeting.phone || assignment?.client_phone || "",
          location: meeting.address || assignment?.client_address || "",
          owner_email: userEmail,
          owner_name: userName,
          source: "meeting_assignment",
          meeting_assignment_id: key,
        };
        // Usuń stare i stwórz nowe równolegle
        await Promise.all([
          ...existingEvents.map(ev => base44.entities.CalendarEvent.delete(ev.id)),
          base44.entities.CalendarEvent.create(eventData),
        ]);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["meetingAssignments"] });
      queryClient.invalidateQueries({ queryKey: ["calendarEvents"] });
      toast.success("Przypisano handlowca i dodano do kalendarza");
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
      if (!assignment) return;
      await base44.entities.MeetingAssignment.delete(assignment.id);
      const key = `${meeting.sheet}__${meeting.client_name}__${meeting.meeting_calendar}`;
      const existingEvents = await base44.entities.CalendarEvent.filter({ meeting_assignment_id: key });
      for (const ev of existingEvents) {
        await base44.entities.CalendarEvent.delete(ev.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetingAssignments"] });
      queryClient.invalidateQueries({ queryKey: ["calendarEvents"] });
      toast.success("Usunięto przypisanie i wydarzenie z kalendarza");
    },
  });

  return (
    <>
    <MeetingDetailModal
      meeting={showDetail ? meeting : null}
      assignment={assignment}
      existingReport={existingReport}
      onClose={() => setShowDetail(false)}
    />
    <DetailsModal
      open={detailsModalOpen}
      onOpenChange={setDetailsModalOpen}
      data={selectedDetails}
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

          {(meeting.agent || meeting.comments || meeting.interview_data || meeting.phone) && (
            <button
              onClick={() => {
                setSelectedDetails({
                  phone: meeting.phone,
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
              {assignment?.assigned_user_email ? (
                <div className="flex items-center gap-2">
                  <Badge className="bg-violet-50 text-violet-700 border-violet-200 text-xs">
                    {assignment.assigned_user_name || assignment.assigned_user_email}
                    {assignment.assigned_user_name && (
                      <span className="ml-1 text-violet-400 font-normal">({assignment.assigned_user_email})</span>
                    )}
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
                    if (count >= 5) {
                      setOverloadConfirm({ userEmail: val, userName: sp?.name || val, count });
                      return;
                    }
                    if (count >= 3) {
                      toast.warning(`Uwaga: ${sp?.name || val} ma już ${count} spotkania tego dnia!`);
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
                      const full = count >= 5;
                      const warn = count >= 3 && count < 5;
                      return (
                        <SelectItem key={sp.email} value={sp.email}>
                          <span className={full ? "text-red-500 font-medium" : warn ? "text-orange-500" : ""}>
                            {sp.name} <span className="text-gray-400 text-[10px]">({sp.email})</span>{count > 0 ? ` (${count}/dz.)` : ""}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {!canAssign && assignment?.assigned_user_email && (
            <Badge className="bg-violet-50 text-violet-700 border-violet-200 text-xs mt-1">
              <UserCheck className="w-3 h-3 mr-1" />
              {assignment.assigned_user_name || assignment.assigned_user_email}
              {assignment.assigned_user_name && (
                <span className="ml-1 text-violet-400 font-normal">({assignment.assigned_user_email})</span>
              )}
            </Badge>
          )}

          {/* Przypisanie do grupy – admin i group_leader */}
          {canManageGroups && groups.length > 0 && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Users className="w-4 h-4 text-gray-400 shrink-0" />
              {assignment?.assigned_group_id ? (
                <div className="flex items-center gap-2">
                  <Badge className="bg-orange-50 text-orange-700 border-orange-200 text-xs">
                    {assignment.assigned_group_name || assignment.assigned_group_id}
                  </Badge>
                  <button
                    onClick={() => unassignGroupMutation.mutate()}
                    className="text-xs text-red-500 hover:underline"
                  >
                    usuń
                  </button>
                </div>
              ) : (
                <Select
                  onValueChange={(val) => {
                    const g = groups.find(gr => gr.id === val);
                    assignGroupMutation.mutate({ groupId: val, groupName: g?.name || g?.data?.name || val });
                  }}
                >
                  <SelectTrigger className="h-7 text-xs w-48">
                    <SelectValue placeholder="Przypisz do grupy..." />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map(g => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.data?.name || g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Pokaż grupę dla team_leader */}
          {currentUserRole === "team_leader" && assignment?.assigned_group_id && (
            <Badge className="bg-orange-50 text-orange-700 border-orange-200 text-xs mt-1">
              <Users className="w-3 h-3 mr-1" />
              {assignment.assigned_group_name}
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