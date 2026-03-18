import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, isPast, isToday } from "date-fns";
import { pl } from "date-fns/locale";
import { Plus, Pencil, Trash2, MapPin, Clock, User, FileText, CheckCircle2, XCircle, CalendarDays } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
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
    prefill_client_name: ev.client_name || ev.title?.replace(/^📋\s*/, "") || "",
    prefill_client_phone: ev.client_phone || "",
    prefill_client_address: ev.location || "",
    prefill_meeting_date: ev.event_date || dateStr,
    prefill_meeting_time: ev.event_time || "",
  });
  return `${createPageUrl("MeetingReports")}?${params.toString()}`;
}

export default function CalendarDayModal({ day, events, currentUser, viewMode, onClose, onEdit, onDelete, onAdd }) {
  const queryClient = useQueryClient();
  const [postponeFor, setPostponeFor] = useState(null);
  const [newDate, setNewDate] = useState("");

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
        source: "manual",
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
                        <p className="text-[10px] text-orange-600">Spotkanie zostanie oznaczone jako przełożone, a raport będzie wymagany po nowej dacie.</p>
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