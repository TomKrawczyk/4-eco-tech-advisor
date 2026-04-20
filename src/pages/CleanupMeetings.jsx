import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Trash2, Search, Calendar, MapPin, Phone, User, AlertTriangle, CheckSquare, Square } from "lucide-react";

const today = new Date().toISOString().split("T")[0];

export default function CleanupMeetings() {
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const queryClient = useQueryClient();

  const { data: assignments = [], isLoading: loadingAssignments } = useQuery({
    queryKey: ["cleanup_assignments"],
    queryFn: () => base44.entities.MeetingAssignment.list("-meeting_date", 500),
  });

  const { data: acceptances = [] } = useQuery({
    queryKey: ["cleanup_acceptances"],
    queryFn: () => base44.entities.MeetingAcceptance.list(),
  });

  const { data: calendarEvents = [] } = useQuery({
    queryKey: ["cleanup_calendar_events"],
    queryFn: () => base44.entities.CalendarEvent.list(),
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: () => base44.entities.Group.list(),
  });

  // Zbiór assignment_id które mają akceptację (status=accepted)
  const acceptedIds = useMemo(() => {
    return new Set(
      acceptances
        .filter(a => a.status === "accepted")
        .map(a => a.meeting_assignment_id)
    );
  }, [acceptances]);

  // Filtruj: przeterminowane + niepodjęte
  const unacceptedPast = useMemo(() => {
    return assignments.filter(a => {
      const isPast = a.meeting_date && a.meeting_date < today;
      const isUnaccepted = !acceptedIds.has(a.id);
      const matchGroup = selectedGroup === "all" || a.assigned_group_id === selectedGroup;
      const matchSearch = !search ||
        a.client_name?.toLowerCase().includes(search.toLowerCase()) ||
        a.client_phone?.includes(search) ||
        a.client_address?.toLowerCase().includes(search.toLowerCase());
      return isPast && isUnaccepted && matchGroup && matchSearch;
    });
  }, [assignments, acceptedIds, selectedGroup, search]);

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === unacceptedPast.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(unacceptedPast.map(a => a.id)));
    }
  };

  const handleDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Usunąć ${selected.size} spotkań wraz z powiązanymi wpisami w kalendarzu?`)) return;

    setDeleting(true);
    try {
      // Znajdź powiązane CalendarEvents
      const eventsToDelete = calendarEvents.filter(e => selected.has(e.meeting_assignment_id));

      // Usuń CalendarEvents
      for (const event of eventsToDelete) {
        await base44.entities.CalendarEvent.delete(event.id);
      }

      // Usuń MeetingAssignments
      for (const id of selected) {
        await base44.entities.MeetingAssignment.delete(id);
      }

      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["cleanup_assignments"] });
      queryClient.invalidateQueries({ queryKey: ["cleanup_calendar_events"] });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
    } finally {
      setDeleting(false);
    }
  };

  const isLoading = loadingAssignments;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Usuwanie niepodjętych spotkań"
        subtitle="Przeterminowane spotkania bez akceptacji handlowców"
      />

      {/* Filtry */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Szukaj klienta, telefonu, adresu..."
            className="pl-9"
          />
        </div>
        <Select value={selectedGroup} onValueChange={setSelectedGroup}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Wszystkie grupy" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie grupy</SelectItem>
            {groups.map(g => (
              <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Akcje */}
      {unacceptedPast.length > 0 && (
        <div className="flex items-center justify-between">
          <button
            onClick={toggleAll}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            {selected.size === unacceptedPast.length
              ? <CheckSquare className="w-4 h-4 text-green-600" />
              : <Square className="w-4 h-4" />}
            Zaznacz wszystkie ({unacceptedPast.length})
          </button>
          {selected.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {deleting ? "Usuwanie..." : `Usuń zaznaczone (${selected.size})`}
            </Button>
          )}
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : unacceptedPast.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Brak niepodjętych przeterminowanych spotkań</p>
        </div>
      ) : (
        <div className="space-y-2">
          {unacceptedPast.map(meeting => {
            const isChecked = selected.has(meeting.id);
            const relatedEvents = calendarEvents.filter(e => e.meeting_assignment_id === meeting.id);
            return (
              <div
                key={meeting.id}
                onClick={() => toggleSelect(meeting.id)}
                className={`bg-white rounded-xl border p-4 cursor-pointer transition-all hover:shadow-sm ${
                  isChecked ? "border-red-300 bg-red-50" : "border-gray-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {isChecked
                      ? <CheckSquare className="w-5 h-5 text-red-500" />
                      : <Square className="w-5 h-5 text-gray-300" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{meeting.client_name}</span>
                      {meeting.assigned_group_name && (
                        <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                          {meeting.assigned_group_name}
                        </Badge>
                      )}
                      {relatedEvents.length > 0 && (
                        <Badge className="bg-orange-50 text-orange-600 border-orange-200 text-xs">
                          +{relatedEvents.length} w kalendarzu
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      {meeting.meeting_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {meeting.meeting_date}
                          {meeting.meeting_calendar && meeting.meeting_calendar !== meeting.meeting_date && (
                            <span className="text-gray-400">({meeting.meeting_calendar})</span>
                          )}
                        </span>
                      )}
                      {meeting.client_phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {meeting.client_phone}
                        </span>
                      )}
                      {meeting.client_address && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {meeting.client_address}
                        </span>
                      )}
                      {meeting.assigned_user_name && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {meeting.assigned_user_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}