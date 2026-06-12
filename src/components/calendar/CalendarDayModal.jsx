import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, isPast, isToday } from "date-fns";
import { pl } from "date-fns/locale";
import { Plus, Pencil, Trash2, MapPin, Clock, User, FileText, CheckCircle2, XCircle, CalendarDays, Info, Phone, MessageSquare, HelpCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const typeLabels = { meeting: "Spotkanie", task: "Zadanie", reminder: "Przypomnienie", other: "Inne" };
const typeColors = {
  meeting: "bg-violet-100 text-violet-700 border-violet-200",
  task: "bg-amber-100 text-amber-700 border-amber-200",
  reminder: "bg-pink-100 text-pink-700 border-pink-200",
  other: "bg-gray-100 text-gray-700 border-gray-200",
};
const statusColors = {
  planned: "bg-blue-50 text-blue-700 border-blue-200",
  completed: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-red-50 text-red-600 border-red-200",
  postponed: "bg-orange-50 text-orange-600 border-orange-200",
};
const statusLabels = { planned: "Zaplanowane", completed: "Zakończone", cancelled: "Odwołane", postponed: "Przełożone" };

function makeReportUrl(ev, day) {
  const dateStr = format(day, "yyyy-MM-dd");
  const params = new URLSearchParams({
    from_meeting: "1",
    prefill_client_name: ev.client_name || ev.title?.replace(/^Spotkanie:\s*/, "")?.replace(/^📋\s*/, "") || "",
    prefill_client_phone: ev.client_phone || "",
    prefill_client_address: ev.location || "",
    prefill_meeting_date: ev.event_date || dateStr,
    prefill_meeting_time: ev.event_time || "",
  });
  return `/MeetingReports?${params.toString()}`;
}

export default function CalendarDayModal({ day, events, currentUser, viewMode, reassignableUsers = [], onClose, onEdit, onDelete, onAdd }) {
  const queryClient = useQueryClient();
  const [postponeFor, setPostponeFor] = useState(null);
  const [newDate, setNewDate] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.CalendarEvent.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries(["calendarEvents"]);
      toast.success("Status zaktualizowany");
    },
    onError: () => toast.error("Błąd aktualizacji statusu"),
  });

  const postponeMutation = useMutation({
    mutationFn: async ({ event, newDate }) => {
      await base44.entities.CalendarEvent.update(event.id, {
        status: "postponed",
        postponed_to: newDate,
      });
      await base44.entities.CalendarEvent.create({
        title: event.title,
        description: event.description,
        event_date: newDate,
        event_time: event.event_time,
        end_time: event.end_time,
        event_type: event.event_type,
        status: "planned",
        client_name: event.client_name,
        client_phone: event.client_phone,
        location: event.location,
        owner_email: event.owner_email,
        owner_name: event.owner_name,
        source: event.source || "manual",
        meeting_assignment_id: event.meeting_assignment_id || "",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["calendarEvents"]);
      toast.success("Spotkanie przełożone — nowe wydarzenie zostało dodane");
      setPostponeFor(null);
      setNewDate("");
    },
    onError: () => toast.error("Błąd podczas przenoszenia spotkania"),
  });

  const reassignMutation = useMutation({
    mutationFn: async ({ event, userEmail, userName }) => {
      await base44.entities.CalendarEvent.update(event.id, {
        owner_email: userEmail,
        owner_name: userName,
      });

      if (event.meeting_assignment_id) {
        const assignments = await base44.entities.MeetingAssignment.filter({ meeting_key: event.meeting_assignment_id });
        const assignment = assignments?.[0];
        if (assignment) {
          await base44.entities.MeetingAssignment.update(assignment.id, {
            assigned_user_email: userEmail,
            assigned_user_name: userName,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["calendarEvents"]);
      queryClient.invalidateQueries(["meetingAssignments"]);
      toast.success("Spotkanie zostało przepisane");
    },
    onError: () => toast.error("Nie udało się przepisać spotkania"),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="capitalize">
            {format(day, "EEEE, d MMMM yyyy", { locale: pl })}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {events.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">Brak wydarzeń tego dnia</p>
          ) : (
            events
              .sort((a, b) => (a.event_time || "").localeCompare(b.event_time || ""))
              .map(ev => {
                const canEdit = currentUser?.email === ev.owner_email || currentUser?.role === "admin";
                const canReassign = ["admin", "group_leader"].includes(currentUser?.role) && ev.event_type === "meeting" && !ev.is_sheet_meeting && ev.status !== "completed" && ev.status !== "cancelled";
                return (
                  <div key={ev.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-sm text-gray-900">{ev.title}</span>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${typeColors[ev.event_type]}`}>
                            {typeLabels[ev.event_type]}
                          </Badge>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusColors[ev.status]}`}>
                            {statusLabels[ev.status]}
                          </Badge>
                        </div>

                        {(ev.event_time || ev.end_time) && (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Clock className="w-3 h-3" />
                            {ev.event_time || ""}{ev.end_time ? ` – ${ev.end_time}` : ""}
                          </div>
                        )}
                        {ev.client_name && (
                          <div className="flex items-center gap-1 text-xs text-gray-600 mt-0.5">
                            <User className="w-3 h-3 text-gray-400" />
                            {ev.client_name}
                            {ev.client_phone && <span className="text-gray-400 ml-1">· {ev.client_phone}</span>}
                          </div>
                        )}
                        {(ev.location || ev.client_address) && (
                          <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                            <MapPin className="w-3 h-3" />
                            {ev.location || ev.client_address}
                          </div>
                        )}
                        {viewMode === "team" && ev.owner_name && (
                          <div className="text-[10px] text-gray-400 mt-1">Handlowiec: {ev.owner_name}</div>
                        )}
                        {ev.description && (
                          <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{ev.description}</p>
                        )}
                      </div>

                      <div className="flex gap-1 shrink-0 flex-wrap justify-end">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-blue-600 hover:bg-blue-50"
                          onClick={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
                          title="Pokaż szczegóły"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </Button>
                        {(ev.event_type === "meeting" || ev.is_sheet_meeting || ev.is_assignment) && (ev.owner_email === currentUser?.email || currentUser?.role === "admin" || !ev.owner_email) && (
                          <Link to={makeReportUrl(ev, day)} onClick={onClose}>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-green-700 border-green-300 hover:bg-green-50 text-[10px] gap-1">
                              <FileText className="w-3 h-3" />
                              Raport
                            </Button>
                          </Link>
                        )}
                        {canEdit && !ev.is_sheet_meeting && (
                          <>
                            {ev.status !== "completed" && (
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600 hover:bg-green-50" title="Zakończone" onClick={() => statusMutation.mutate({ id: ev.id, status: "completed" })}>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {ev.status !== "postponed" && (
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-orange-500 hover:bg-orange-50" title="Przenieś na inny dzień" onClick={() => { setPostponeFor(ev.id); setNewDate(""); }}>
                                <CalendarDays className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {ev.status !== "cancelled" && (
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:bg-red-50" title="Odwołane" onClick={() => statusMutation.mutate({ id: ev.id, status: "cancelled" })}>
                                <XCircle className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {ev.status !== "planned" && (
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-500 hover:bg-blue-50" title="Przywróć jako zaplanowane" onClick={() => statusMutation.mutate({ id: ev.id, status: "planned" })}>
                                <CheckCircle2 className="w-3.5 h-3.5 rotate-180" />
                              </Button>
                            )}
                            {!ev.is_assignment && (
                              <>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(ev)}>
                                  <Pencil className="w-3.5 h-3.5 text-gray-500" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => onDelete(ev.id)}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {expandedId === ev.id && (() => {
                      const interviewEntries = ev.interview_data
                        ? Object.entries(ev.interview_data).filter(([, v]) => v)
                        : [];
                      return (
                        <div className="space-y-2">
                          {canReassign && reassignableUsers.length > 0 && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                              <div className="text-xs font-medium text-blue-800">Przepisz spotkanie do innego handlowca</div>
                              <Select
                                disabled={reassignMutation.isPending}
                                onValueChange={(value) => {
                                  const nextUser = reassignableUsers.find(user => user.email === value);
                                  if (!nextUser || value === ev.owner_email) return;
                                  reassignMutation.mutate({ event: ev, userEmail: nextUser.email, userName: nextUser.name || nextUser.email });
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs bg-white">
                                  <SelectValue placeholder="Wybierz handlowca lub doradcę" />
                                </SelectTrigger>
                                <SelectContent>
                                  {reassignableUsers.map(user => (
                                    <SelectItem key={user.email} value={user.email}>
                                      {user.name} ({user.email})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {ev.owner_name && (
                                <div className="text-[10px] text-blue-700">Obecnie przypisane do: {ev.owner_name}{ev.owner_email ? ` (${ev.owner_email})` : ""}</div>
                              )}
                            </div>
                          )}
                          {(ev.sheet || ev.agent || ev.status_label) && (
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1 text-xs text-slate-600">
                              {ev.sheet && <div><span className="font-semibold text-slate-800">Arkusz:</span> {ev.sheet}</div>}
                              {ev.agent && <div><span className="font-semibold text-slate-800">Handlowiec z arkusza:</span> {ev.agent}</div>}
                              {ev.status_label && <div><span className="font-semibold text-slate-800">Status z arkusza:</span> {ev.status_label}</div>}
                            </div>
                          )}

                          {ev.comments && (
                            <div className="bg-emerald-50 border-l-4 border-emerald-400 rounded-r-lg p-3">
                              <div className="flex items-center gap-1.5 text-emerald-700 text-[10px] font-bold uppercase tracking-wide mb-1.5">
                                <MessageSquare className="w-3.5 h-3.5" /> Komentarz z arkusza
                              </div>
                              <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{ev.comments}</p>
                            </div>
                          )}

                          {interviewEntries.length > 0 && (
                            <div className="bg-purple-50 border-l-4 border-purple-400 rounded-r-lg p-3">
                              <div className="flex items-center gap-1.5 text-purple-700 text-[10px] font-bold uppercase tracking-wide mb-2">
                                <HelpCircle className="w-3.5 h-3.5" /> Dane z arkusza
                              </div>
                              <div className="space-y-1.5">
                                {interviewEntries.map(([k, v]) => (
                                  <div key={k} className="bg-white rounded-md p-2 border border-purple-100">
                                    <div className="text-[11px] font-semibold text-purple-700 mb-0.5">{k}</div>
                                    <div className="text-sm text-gray-800 break-words whitespace-pre-wrap">{String(v)}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {!ev.comments && interviewEntries.length === 0 && !ev.agent && !ev.sheet && !ev.status_label && (
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-500 italic text-center">
                              Brak danych z arkusza do pokazania
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {postponeFor === ev.id && (
                      <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg space-y-2">
                        <Label className="text-xs font-medium text-orange-800">Przenieś na nową datę:</Label>
                        <div className="flex gap-2 items-center">
                          <Input
                            type="date"
                            value={newDate}
                            min={new Date().toISOString().split("T")[0]}
                            onChange={e => setNewDate(e.target.value)}
                            className="h-8 text-sm"
                          />
                          <Button
                            size="sm"
                            className="bg-orange-500 hover:bg-orange-600 h-8 text-xs"
                            disabled={!newDate || postponeMutation.isPending}
                            onClick={() => postponeMutation.mutate({ event: ev, newDate })}
                          >
                            Przenieś
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setPostponeFor(null)}>
                            Anuluj
                          </Button>
                        </div>
                        <p className="text-[10px] text-orange-600">Spotkanie zostanie oznaczone jako przełożone, a raport będzie wymagany po nowej dacie; po przeniesieniu możesz też przepisać je na inną osobę.</p>
                      </div>
                    )}
                  </div>
                );
              })
          )}
        </div>

        <Button onClick={onAdd} className="w-full mt-2 bg-green-600 hover:bg-green-700 gap-2">
          <Plus className="w-4 h-4" /> Dodaj wydarzenie
        </Button>
      </DialogContent>
    </Dialog>
  );
}