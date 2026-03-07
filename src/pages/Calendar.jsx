import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/shared/PageHeader";
import { ChevronLeft, ChevronRight, Plus, Users } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isToday, isSameDay, parseISO, isValid } from "date-fns";
import { pl } from "date-fns/locale";
import CalendarEventModal from "@/components/calendar/CalendarEventModal.jsx";
import CalendarDayModal from "@/components/calendar/CalendarDayModal.jsx";

// Parsuje daty w formacie "DD.MM.YYYY HH:MM" lub "DD.MM.YYYY"
function parseMeetingDate(str) {
  if (!str) return null;
  const match = str.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (match) {
    const [, d, m, y] = match;
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    if (isValid(date)) return date;
  }
  const parsed = new Date(str);
  if (isValid(parsed)) return parsed;
  return null;
}

export default function Calendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentUser, setCurrentUser] = useState(null);
  const [viewMode, setViewMode] = useState("own"); // "own" | "team"
  const [selectedDay, setSelectedDay] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    const fetchUser = async () => {
      const user = await base44.auth.me();
      const allowedUsers = await base44.entities.AllowedUser.list();
      const ua = allowedUsers.find(a => (a.data?.email || a.email) === user.email);
      if (ua) {
        user.role = ua.data?.role || ua.role;
        user.displayName = ua.data?.name || ua.name;
        user.groupId = ua.data?.group_id || ua.group_id;
        user.allowedUserRecord = ua;
      }
      setCurrentUser(user);
    };
    fetchUser();
  }, []);

  const isLeaderOrAdmin = currentUser?.role === "admin" || currentUser?.role === "group_leader" || currentUser?.role === "team_leader";

  const { data: allUsers = [] } = useQuery({
    queryKey: ["allowedUsersCalendar"],
    queryFn: () => base44.entities.AllowedUser.list(),
    enabled: !!currentUser,
  });

  const { data: events = [] } = useQuery({
    queryKey: ["calendarEvents"],
    queryFn: () => base44.entities.CalendarEvent.list("-event_date", 500),
    enabled: !!currentUser,
  });

  // Pobierz spotkania z arkuszy (dla liderów/admin) i przypisania
  const { data: sheetResult } = useQuery({
    queryKey: ["sheetMeetings"],
    queryFn: () => base44.functions.invoke("getMeetingsFromSheets").then(r => r.data),
    enabled: !!currentUser && isLeaderOrAdmin,
    staleTime: 5 * 60 * 1000,
  });

  const { data: meetingAssignments = [] } = useQuery({
    queryKey: ["meetingAssignments"],
    queryFn: () => base44.entities.MeetingAssignment.list(),
    enabled: !!currentUser,
  });

  const { data: sheetMappings = [] } = useQuery({
    queryKey: ["sheetMappings"],
    queryFn: () => base44.entities.SheetGroupMapping.list(),
    enabled: !!currentUser && isLeaderOrAdmin,
  });

  const allSheetMeetings = sheetResult?.meetings || [];

  // Filtruj użytkowników w grupie lidera
  const groupUserEmails = useMemo(() => {
    if (!currentUser || !isLeaderOrAdmin) return [];
    if (currentUser.role === "admin") return allUsers.map(u => u.data?.email || u.email);
    return allUsers
      .filter(u => (u.data?.group_id || u.group_id) === currentUser.groupId)
      .map(u => u.data?.email || u.email);
  }, [allUsers, currentUser, isLeaderOrAdmin]);

  // Emaile zespołu team_leadera
  const teamMemberEmails = useMemo(() => {
    if (!currentUser || currentUser.role !== "team_leader") return [];
    const myAllowedUser = allUsers.find(u => (u.data?.email || u.email) === currentUser.email);
    const managedIds = myAllowedUser?.managed_users || myAllowedUser?.data?.managed_users || [];
    const emails = allUsers
      .filter(u => managedIds.includes(u.id))
      .map(u => u.data?.email || u.email);
    emails.push(currentUser.email);
    return emails;
  }, [allUsers, currentUser]);

  // Konwertuj spotkania z arkuszy na pseudo-eventy kalendarza (dla wyświetlania)
  const sheetMeetingEvents = useMemo(() => {
    if (!currentUser || !isLeaderOrAdmin) return [];

    const currentUserGroupId = currentUser.role === "admin" ? null : (currentUser.groupId || null);

    return allSheetMeetings
      .filter(m => {
        if (!m.meeting_calendar) return false;
        const d = parseMeetingDate(m.meeting_calendar);
        if (!d) return false;

        const key = `${m.sheet}__${m.client_name}__${m.meeting_calendar}`;
        const assignment = meetingAssignments.find(a => a.meeting_key === key);

        // Sprawdź czy to spotkanie już ma CalendarEvent (żeby nie duplikować)
        const hasCalendarEvent = events.some(e => e.meeting_assignment_id === key);
        if (hasCalendarEvent) return false;

        // Filtruj wg roli
        if (currentUser.role === "admin") return true;
        if (currentUser.role === "group_leader") {
          if (!currentUserGroupId) return true;
          const sheetMapping = sheetMappings.find(sm => sm.sheet_name === m.sheet);
          if (sheetMapping?.group_id === currentUserGroupId) return true;
          if (assignment?.assigned_group_id === currentUserGroupId) return true;
          return false;
        }
        if (currentUser.role === "team_leader") {
          if (assignment) {
            if (teamMemberEmails.includes(assignment.assigned_user_email)) return true;
            if (currentUserGroupId && assignment.assigned_group_id === currentUserGroupId) return true;
          }
          // Nieprzypisane z arkuszy grupy
          if (!assignment && currentUserGroupId) {
            const sheetMapping = sheetMappings.find(sm => sm.sheet_name === m.sheet);
            return sheetMapping?.group_id === currentUserGroupId;
          }
          return false;
        }
        return false;
      })
      .map(m => {
        const d = parseMeetingDate(m.meeting_calendar);
        const timeMatch = m.meeting_calendar?.match(/(\d{1,2}):(\d{2})/);
        const time = timeMatch ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}` : "";
        const key = `${m.sheet}__${m.client_name}__${m.meeting_calendar}`;
        const assignment = meetingAssignments.find(a => a.meeting_key === key);

        return {
          id: `sheet_${key}`,
          title: `📋 ${m.client_name}`,
          description: `Arkusz: ${m.sheet}${m.address ? `\nAdres: ${m.address}` : ""}`,
          event_date: d ? format(d, "yyyy-MM-dd") : "",
          event_time: time,
          event_type: "meeting",
          status: assignment ? "planned" : "planned",
          client_name: m.client_name,
          client_phone: m.phone || "",
          location: m.address || "",
          owner_email: assignment?.assigned_user_email || "",
          owner_name: assignment?.assigned_user_name || `(${m.sheet})`,
          source: "sheet",
          is_sheet_meeting: true,
        };
      });
  }, [allSheetMeetings, currentUser, isLeaderOrAdmin, meetingAssignments, events, sheetMappings, teamMemberEmails]);

  // Filtruj wydarzenia wg trybu + dodaj spotkania z arkuszy
  const visibleEvents = useMemo(() => {
    if (!currentUser) return [];

    let calEvents;
    if (viewMode === "team" && isLeaderOrAdmin) {
      if (currentUser.role === "admin") {
        calEvents = events;
      } else if (currentUser.role === "group_leader") {
        calEvents = events.filter(e => groupUserEmails.includes(e.owner_email));
      } else if (currentUser.role === "team_leader") {
        calEvents = events.filter(e => teamMemberEmails.includes(e.owner_email));
      } else {
        calEvents = events.filter(e => e.owner_email === currentUser.email);
      }
    } else {
      calEvents = events.filter(e => e.owner_email === currentUser.email);
    }

    // W trybie zespołu, dodaj spotkania z arkuszy
    if (viewMode === "team" && isLeaderOrAdmin) {
      return [...calEvents, ...sheetMeetingEvents];
    }

    return calEvents;
  }, [events, currentUser, viewMode, groupUserEmails, isLeaderOrAdmin, sheetMeetingEvents, teamMemberEmails]);

  // Dni miesiąca
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd });

  const getEventsForDay = (day) =>
    visibleEvents.filter(e => {
      if (!e.event_date) return false;
      try {
        return isSameDay(parseISO(e.event_date), day);
      } catch {
        return false;
      }
    });

  const typeColors = {
    meeting: "bg-violet-500",
    task: "bg-amber-500",
    reminder: "bg-pink-500",
    other: "bg-gray-500",
  };

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.CalendarEvent.delete(id),
    onSuccess: () => queryClient.invalidateQueries(["calendarEvents"]),
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Kalendarz" subtitle="Planowanie i zarządzanie spotkaniami" />

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-semibold text-gray-800 min-w-[140px] text-center capitalize">
            {format(currentMonth, "LLLL yyyy", { locale: pl })}
          </span>
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())} className="text-xs">Dziś</Button>
        </div>

        <div className="flex items-center gap-2">
          {isLeaderOrAdmin && (
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => setViewMode("own")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "own" ? "bg-green-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
              >
                Mój
              </button>
              <button
                onClick={() => setViewMode("team")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1 ${viewMode === "team" ? "bg-green-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
              >
                <Users className="w-3 h-3" /> Zespół
              </button>
            </div>
          )}
          <Button
            onClick={() => { setEditingEvent(null); setShowEventModal(true); }}
            className="bg-green-600 hover:bg-green-700 gap-1.5 text-sm"
          >
            <Plus className="w-4 h-4" /> Dodaj
          </Button>
        </div>
      </div>

      {/* Kalendarz */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Nagłówki dni */}
        <div className="grid grid-cols-7 border-b border-gray-200">
          {["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"].map(d => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        {/* Dni */}
        <div className="grid grid-cols-7">
          {calDays.map((day, idx) => {
            const dayEvents = getEventsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isCurrentDay = isToday(day);
            return (
              <div
                key={idx}
                onClick={() => setSelectedDay(day)}
                className={`min-h-[80px] p-1.5 border-b border-r border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                  !isCurrentMonth ? "bg-gray-50/60" : ""
                } ${idx % 7 === 6 ? "border-r-0" : ""}`}
              >
                <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ${
                  isCurrentDay ? "bg-green-600 text-white" : isCurrentMonth ? "text-gray-700" : "text-gray-400"
                }`}>
                  {format(day, "d")}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map((ev, i) => (
                    <div
                      key={i}
                      className={`text-[10px] text-white rounded px-1 py-0.5 truncate ${
                        ev.is_sheet_meeting ? "bg-emerald-500" : (typeColors[ev.event_type] || "bg-gray-400")
                      }`}
                      title={ev.title}
                    >
                      {ev.event_time && <span className="opacity-80">{ev.event_time} </span>}
                      {ev.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-gray-500 pl-1">+{dayEvents.length - 3} więcej</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
        {[
          { color: "bg-violet-500", label: "Spotkanie" },
          { color: "bg-amber-500", label: "Zadanie" },
          { color: "bg-pink-500", label: "Przypomnienie" },
          { color: "bg-gray-500", label: "Inne" },
          ...(isLeaderOrAdmin ? [{ color: "bg-emerald-500", label: "Z arkusza (nieprzypisane)" }] : []),
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${l.color}`} />
            {l.label}
          </div>
        ))}
      </div>

      {/* Modals */}
      {selectedDay && (
        <CalendarDayModal
          day={selectedDay}
          events={getEventsForDay(selectedDay)}
          currentUser={currentUser}
          viewMode={viewMode}
          onClose={() => setSelectedDay(null)}
          onEdit={(ev) => {
            if (ev.is_sheet_meeting) return; // Nie można edytować spotkań z arkusza
            setEditingEvent(ev);
            setShowEventModal(true);
            setSelectedDay(null);
          }}
          onDelete={(id) => {
            if (typeof id === "string" && id.startsWith("sheet_")) return; // Nie można usunąć spotkań z arkusza
            deleteMutation.mutate(id);
          }}
          onAdd={() => { setEditingEvent({ event_date: format(selectedDay, "yyyy-MM-dd") }); setShowEventModal(true); setSelectedDay(null); }}
        />
      )}

      {showEventModal && (
        <CalendarEventModal
          initialData={editingEvent}
          currentUser={currentUser}
          onClose={() => { setShowEventModal(false); setEditingEvent(null); }}
          onSaved={() => queryClient.invalidateQueries(["calendarEvents"])}
        />
      )}
    </div>
  );
}