import React, { useState, useMemo, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/shared/PageHeader";
import { ChevronLeft, ChevronRight, Plus, Users, LayoutGrid, X, Phone, MapPin, Clock } from "lucide-react";
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

// Modal z listą spotkań/kontaktów dla danego dnia w trybie grup
function GroupDayModal({ day, items, groupName, onClose }) {
  const meetings = items.filter(i => i.type === "meeting");
  const contacts = items.filter(i => i.type === "phone_contact");

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-bold text-gray-900 text-base">{format(day, "d MMMM yyyy", { locale: pl })}</h2>
            <p className="text-xs text-gray-500">{groupName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {items.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">Brak spotkań i kontaktów</p>
          )}

          {meetings.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">
                Spotkania ({meetings.length})
              </h3>
              <div className="space-y-2">
                {meetings.map((m, i) => (
                  <div key={i} className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-1">
                    <div className="font-semibold text-gray-900 text-sm">{m.client_name}</div>
                    {m.event_time && (
                      <div className="flex items-center gap-1 text-xs text-gray-600">
                        <Clock className="w-3 h-3" /> {m.event_time}
                      </div>
                    )}
                    {m.client_phone && (
                      <div className="flex items-center gap-1 text-xs text-gray-600">
                        <Phone className="w-3 h-3" /> {m.client_phone}
                      </div>
                    )}
                    {m.location && (
                      <div className="flex items-center gap-1 text-xs text-gray-600">
                        <MapPin className="w-3 h-3" /> {m.location}
                      </div>
                    )}
                    {m.agent && (
                      <div className="text-xs text-gray-500">Agent: {m.agent}</div>
                    )}
                    {m.comments && (
                      <div className="text-xs text-gray-500 italic">{m.comments}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {contacts.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">
                Kontakty telefoniczne ({contacts.length})
              </h3>
              <div className="space-y-2">
                {contacts.map((c, i) => (
                  <div key={i} className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-1">
                    <div className="font-semibold text-gray-900 text-sm">{c.client_name}</div>
                    {c.event_time && (
                      <div className="flex items-center gap-1 text-xs text-gray-600">
                        <Clock className="w-3 h-3" /> {c.event_time}
                      </div>
                    )}
                    {c.client_phone && (
                      <div className="flex items-center gap-1 text-xs text-gray-600">
                        <Phone className="w-3 h-3" /> {c.client_phone}
                      </div>
                    )}
                    {c.address && (
                      <div className="flex items-center gap-1 text-xs text-gray-600">
                        <MapPin className="w-3 h-3" /> {c.address}
                      </div>
                    )}
                    {c.agent && (
                      <div className="text-xs text-gray-500">Agent: {c.agent}</div>
                    )}
                    {c.status && (
                      <div className="text-xs text-gray-500">Status: {c.status}</div>
                    )}
                    {c.comments && (
                      <div className="text-xs text-gray-500 italic">{c.comments}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Calendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentUser, setCurrentUser] = useState(null);
  const [viewMode, setViewMode] = useState("own"); // "own" | "team" | "groups"
  const [selectedDay, setSelectedDay] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupDaySelected, setGroupDaySelected] = useState(null); // { day, items }
  const queryClient = useQueryClient();

  useEffect(() => {
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

  const { data: groups = [] } = useQuery({
    queryKey: ["groupsCalendar"],
    queryFn: () => base44.entities.Group.list(),
    enabled: !!currentUser && currentUser?.role === "admin",
  });

  const { data: phoneContactsDB = [] } = useQuery({
    queryKey: ["phoneContactsCalendar"],
    queryFn: () => base44.entities.PhoneContact.list("-contact_date", 2000),
    enabled: !!currentUser && currentUser?.role === "admin",
  });

  const allSheetMeetings = sheetResult?.meetings || [];
  const allSheetContacts = sheetResult?.contacts || [];

  // Ustaw domyślną grupę gdy wchodzi w tryb groups
  useEffect(() => {
    if (viewMode === "groups" && !selectedGroup && groups.length > 0) {
      setSelectedGroup(groups[0].id);
    }
  }, [viewMode, groups, selectedGroup]);

  const groupUserEmails = useMemo(() => {
    if (!currentUser || !isLeaderOrAdmin) return [];
    if (currentUser.role === "admin") return allUsers.map(u => u.data?.email || u.email);
    return allUsers
      .filter(u => (u.data?.group_id || u.group_id) === currentUser.groupId)
      .map(u => u.data?.email || u.email);
  }, [allUsers, currentUser, isLeaderOrAdmin]);

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
        const hasCalendarEvent = events.some(e => e.meeting_assignment_id === key);
        if (hasCalendarEvent) return false;
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
          status: "planned",
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
      try { return isSameDay(parseISO(e.event_date), day); } catch { return false; }
    });

  // Buduje listę spotkań i kontaktów dla danego dnia i grupy (tryb groups)
  const getGroupItemsForDay = (day, groupId) => {
    const sheetsForGroup = sheetMappings
      .filter(sm => sm.group_id === groupId)
      .map(sm => sm.sheet_name);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const meetings = allSheetMeetings.filter(m => {
      if (!m.meeting_calendar) return false;
      const d = parseMeetingDate(m.meeting_calendar);
      if (!d || !isSameDay(d, day)) return false;
      const key = `${m.sheet}__${m.client_name}__${m.meeting_calendar}`;
      const assignment = meetingAssignments.find(a => a.meeting_key === key);
      // Nie pokazuj przeszłych spotkań bez przypisania (stare, niepodjęte z arkusza)
      if (!assignment && d < today) return false;
      if (assignment) return assignment.assigned_group_id === groupId;
      return sheetsForGroup.includes(m.sheet);
    }).map(m => {
      const d = parseMeetingDate(m.meeting_calendar);
      const timeMatch = m.meeting_calendar?.match(/(\d{1,2}):(\d{2})/);
      const time = timeMatch ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}` : "";
      return {
        type: "meeting",
        client_name: m.client_name,
        event_time: time,
        client_phone: m.client_phone || m.phone || "",
        location: m.address || "",
        agent: m.agent || "",
        comments: m.comments || "",
      };
    });

    const contacts = allSheetContacts.filter(c => {
      const dateStr = c.contact_calendar || c.contact_date || c.date;
      const d = parseMeetingDate(dateStr);
      if (!d || !isSameDay(d, day)) return false;
      const dbRecord = phoneContactsDB.find(db => db.contact_key === c.contact_key);
      const assignedGroupId = dbRecord?.assigned_group_id || c.assigned_group_id;
      if (assignedGroupId) return assignedGroupId === groupId;
      return sheetsForGroup.includes(c.sheet);
    }).map(c => {
      const dateStr = c.contact_calendar || c.contact_date || c.date;
      const timeMatch = dateStr?.match(/(\d{1,2}):(\d{2})/);
      const time = timeMatch ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}` : "";
      return {
        type: "phone_contact",
        client_name: c.client_name,
        event_time: time,
        client_phone: c.phone || "",
        address: c.address || "",
        agent: c.agent || "",
        status: c.status || "",
        comments: c.comments || "",
      };
    });

    return [...meetings, ...contacts];
  };

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

  const selectedGroupObj = groups.find(g => g.id === selectedGroup);

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
              {currentUser?.role === "admin" && (
                <button
                  onClick={() => setViewMode("groups")}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1 ${viewMode === "groups" ? "bg-green-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
                >
                  <LayoutGrid className="w-3 h-3" /> Grupy
                </button>
              )}
            </div>
          )}
          {viewMode !== "groups" && (
            <Button
              onClick={() => { setEditingEvent(null); setShowEventModal(true); }}
              className="bg-green-600 hover:bg-green-700 gap-1.5 text-sm"
            >
              <Plus className="w-4 h-4" /> Dodaj
            </Button>
          )}
        </div>
      </div>

      {/* Widok grup (tylko admin) */}
      {viewMode === "groups" && currentUser?.role === "admin" ? (
        <div className="space-y-3">
          {/* Selector grupy */}
          {groups.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {groups.map(g => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGroup(g.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    selectedGroup === g.id
                      ? "bg-green-600 text-white border-green-600"
                      : "bg-white text-gray-700 border-gray-200 hover:border-green-300 hover:bg-green-50"
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          )}

          {selectedGroup && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="grid grid-cols-7 border-b border-gray-200">
                {["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"].map(d => (
                  <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {calDays.map((day, idx) => {
                  const items = getGroupItemsForDay(day, selectedGroup);
                  const meetingItems = items.filter(i => i.type === "meeting");
                  const contactItems = items.filter(i => i.type === "phone_contact");
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isCurrentDay = isToday(day);
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        if (items.length > 0) setGroupDaySelected({ day, items });
                      }}
                      className={`min-h-[80px] p-1.5 border-b border-r border-gray-100 transition-colors ${
                        !isCurrentMonth ? "bg-gray-50/60" : ""
                      } ${idx % 7 === 6 ? "border-r-0" : ""} ${items.length > 0 ? "cursor-pointer hover:bg-gray-50" : ""}`}
                    >
                      <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ${
                        isCurrentDay ? "bg-green-600 text-white" : isCurrentMonth ? "text-gray-700" : "text-gray-400"
                      }`}>
                        {format(day, "d")}
                      </div>
                      <div className="space-y-0.5">
                        {meetingItems.slice(0, 2).map((m, i) => (
                          <div key={i} className="text-[10px] text-white rounded px-1 py-0.5 truncate bg-emerald-500" title={m.client_name}>
                            {m.event_time && <span className="opacity-80">{m.event_time} </span>}
                            📋 {m.client_name}
                          </div>
                        ))}
                        {contactItems.slice(0, 2).map((c, i) => (
                          <div key={i} className="text-[10px] text-white rounded px-1 py-0.5 truncate bg-blue-500" title={c.client_name}>
                            {c.event_time && <span className="opacity-80">{c.event_time} </span>}
                            📞 {c.client_name}
                          </div>
                        ))}
                        {items.length > 4 && (
                          <div className="text-[10px] text-gray-500 pl-1">+{items.length - 4} więcej</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Spotkanie (arkusz)</div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Kontakt telefoniczny</div>
          </div>
        </div>
      ) : (
        <>
          {/* Standardowy kalendarz */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="grid grid-cols-7 border-b border-gray-200">
              {["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"].map(d => (
                <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {d}
                </div>
              ))}
            </div>
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
        </>
      )}

      {/* Modals */}
      {selectedDay && viewMode !== "groups" && (
        <CalendarDayModal
          day={selectedDay}
          events={getEventsForDay(selectedDay)}
          currentUser={currentUser}
          viewMode={viewMode}
          onClose={() => setSelectedDay(null)}
          onEdit={(ev) => {
            if (ev.is_sheet_meeting) return;
            setEditingEvent(ev);
            setShowEventModal(true);
            setSelectedDay(null);
          }}
          onDelete={(id) => {
            if (typeof id === "string" && id.startsWith("sheet_")) return;
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

      {/* Modal dnia w trybie grup */}
      {groupDaySelected && (
        <GroupDayModal
          day={groupDaySelected.day}
          items={groupDaySelected.items}
          groupName={selectedGroupObj?.name || ""}
          onClose={() => setGroupDaySelected(null)}
        />
      )}
    </div>
  );
}