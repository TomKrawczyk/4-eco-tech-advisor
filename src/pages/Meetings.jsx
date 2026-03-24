import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import useCurrentUser from "@/components/shared/useCurrentUser";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Search, Table2, ChevronDown, ChevronUp, Settings2, MessageSquare, BarChart2, Bell, Calendar, User, MapPin, Phone, Clock, FileText, CheckSquare, ClipboardList } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import DetailsModal from "@/components/shared/DetailsModal";
import { motion, AnimatePresence } from "framer-motion";
import SheetMappingPanel from "@/components/meetings/SheetMappingPanel";
import MeetingCard from "@/components/meetings/MeetingCard";
import AssignmentStats from "@/components/meetings/AssignmentStats";
import { format, addDays, isValid, startOfDay } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

// Parsuje daty w różnych formatach polskich: "DD.MM.YYYY HH:MM", "DD.MM.YYYY", itp.
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

function formatDateLabel(dateStr) {
  const today = startOfDay(new Date());
  const d = parseMeetingDate(dateStr);
  if (!d) return dateStr;
  const diff = Math.round((startOfDay(d) - today) / 86400000);
  const dayName = d.toLocaleDateString("pl-PL", { weekday: "long" });
  const dateFormatted = d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
  if (diff === 0) return `Dziś (${dateFormatted})`;
  if (diff === 1) return `Jutro (${dateFormatted})`;
  return `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} (${dateFormatted})`;
}

function extractTime(calStr) {
  if (!calStr) return "";
  const match = calStr.match(/(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : "";
}

// Widok spotkań dla zwykłego użytkownika – z pełnymi szczegółami i akcjami
function UserMeetingsView({ myAssignedMeetings, selectedDetails, setSelectedDetails, detailsModalOpen, setDetailsModalOpen }) {
  const groupedByDate = useMemo(() => {
    const groups = {};
    myAssignedMeetings.forEach(a => {
      const d = parseMeetingDate(a.meeting_calendar);
      const dateKey = d ? format(startOfDay(d), "yyyy-MM-dd") : "unknown";
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(a);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [myAssignedMeetings]);

  const actions = [
    { label: "Raport po spotkaniu", icon: FileText, color: "bg-green-600", page: "MeetingReports", desc: "Utwórz raport ze spotkania" },
    { label: "Checklista techniczna", icon: CheckSquare, color: "bg-blue-600", page: "Checklist", desc: "Uzupełnij checklistę" },
    { label: "Wywiad z klientem", icon: MessageSquare, color: "bg-violet-600", page: "Interview", desc: "Przeprowadź wywiad" },
    { label: "Raport wizyty", icon: ClipboardList, color: "bg-orange-600", page: "VisitReports", desc: "Szczegółowy raport wizyty" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Moje spotkania"
        subtitle="Spotkania przypisane do Ciebie – najbliższe 14 dni"
      />
      {myAssignedMeetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Table2 className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="font-semibold text-gray-800 mb-1">Brak przypisanych spotkań</h3>
          <p className="text-sm text-gray-500">Nie masz żadnych spotkań w ciągu najbliższych 14 dni.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groupedByDate.map(([dateKey, meetings]) => (
            <div key={dateKey}>
              <div className="flex items-center gap-2 mb-3 px-1">
                <Calendar className="w-4 h-4 text-green-600" />
                <span className="text-sm font-semibold text-gray-700">
                  {formatDateLabel(meetings[0].meeting_calendar)}
                </span>
                <div className="flex-1 h-px bg-gray-200" />
                <Badge variant="outline" className="text-[10px] text-gray-500">
                  {meetings.length} {meetings.length === 1 ? "spotkanie" : "spotkań"}
                </Badge>
              </div>

              <div className="space-y-3">
                {meetings.map((a, i) => {
                  const clientParams = new URLSearchParams({
                    prefill_client_name: a.client_name || "",
                    prefill_client_phone: a.client_phone || a.phone || "",
                    prefill_client_address: a.client_address || a.address || "",
                    prefill_meeting_date: a.meeting_date || "",
                    prefill_meeting_time: extractTime(a.meeting_calendar) || "",
                    from_meeting: "1",
                  }).toString();

                  const hasDetails = a.agent || a.comments || a.notes || a.interview_data;

                  return (
                    <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 hover:border-green-200 hover:shadow-sm transition-all">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <User className="w-4 h-4 text-gray-400 shrink-0" />
                          <span className="font-semibold text-gray-900 text-sm">{a.client_name}</span>
                          <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px]">{a.sheet}</Badge>
                          {a.assigned_user_email && (
                            <Badge className="bg-violet-50 text-violet-700 border-violet-200 text-[10px]">
                              Przypisane do Ciebie
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs font-semibold text-green-700 bg-green-50 rounded-md px-2 py-1.5 w-fit">
                          <Calendar className="w-3.5 h-3.5 shrink-0" />
                          {a.meeting_calendar}
                        </div>

                        {(a.client_address || a.address) && (
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            {a.client_address || a.address}
                          </div>
                        )}

                        {(a.client_phone || a.phone) && (
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <a href={`tel:${a.client_phone || a.phone}`} className="hover:text-green-600 transition-colors font-medium">
                              {a.client_phone || a.phone}
                            </a>
                          </div>
                        )}

                        {a.agent && (
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            Agent: {a.agent}
                          </div>
                        )}

                        {a.notes && (
                          <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">{a.notes}</p>
                        )}

                        {hasDetails && (
                          <button
                            onClick={() => {
                              setSelectedDetails({
                                phone: a.client_phone || a.phone,
                                agent: a.agent,
                                comments: a.comments || a.notes,
                                interview_data: a.interview_data || {}
                              });
                              setDetailsModalOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors inline-flex items-center gap-1"
                          >
                            <MessageSquare className="w-3 h-3" />
                            Szczegóły kontaktu
                          </button>
                        )}

                        <div className="pt-2 border-t border-gray-100 mt-2">
                          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-2">Utwórz dokument</p>
                          <div className="grid grid-cols-2 gap-2">
                            {actions.map(({ label, icon: Icon, color, page, desc }) => (
                              <Link
                                key={page}
                                to={`${createPageUrl(page)}?${clientParams}`}
                                className="flex items-center gap-2 rounded-lg px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-all"
                              >
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color} shrink-0`}>
                                  <Icon className="w-3.5 h-3.5 text-white" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-medium text-gray-800 truncate">{label}</div>
                                  <div className="text-[10px] text-gray-400 truncate">{desc}</div>
                                </div>
                              </Link>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <DetailsModal
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
        data={selectedDetails}
      />
    </div>
  );
}

export default function Meetings() {
  const { currentUser, accessChecked } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [sheetFilter, setSheetFilter] = useState("all");
  const [expandedSheets, setExpandedSheets] = useState({});
  const [showMappingPanel, setShowMappingPanel] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [selectedDetails, setSelectedDetails] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [notifySending, setNotifySending] = useState(false);

  const isLeaderOrAdmin = currentUser?.role === "admin" || currentUser?.role === "group_leader" || currentUser?.role === "team_leader";
  const isAdminOrGroupLeader = currentUser?.role === "admin" || currentUser?.role === "group_leader";

  const { data: groups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: () => base44.entities.Group.list(),
    enabled: accessChecked && isLeaderOrAdmin,
  });

  const { data: sheetMappings = [] } = useQuery({
    queryKey: ["sheetMappings"],
    queryFn: () => base44.entities.SheetGroupMapping.list(),
    enabled: accessChecked,
  });

  const { data: allAllowedUsers = [] } = useQuery({
    queryKey: ["allowedUsers"],
    queryFn: () => base44.entities.AllowedUser.list(),
    enabled: accessChecked,
  });

  const { data: meetingAssignments = [] } = useQuery({
    queryKey: ["meetingAssignments"],
    queryFn: () => base44.entities.MeetingAssignment.list(),
    enabled: accessChecked,
  });

  const { data: meetingReports = [] } = useQuery({
    queryKey: ["meetingReportsForMeetings"],
    queryFn: () => base44.entities.MeetingReport.list("-created_date", 200),
    enabled: accessChecked && isLeaderOrAdmin,
  });

  // Dane z arkusza – pobiera admin, group_leader i team_leader (backend wymaga tych ról)
  const { data: result, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["sheetMeetings"],
    queryFn: () => base44.functions.invoke("getMeetingsFromSheets").then(r => r.data),
    enabled: accessChecked && isLeaderOrAdmin,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const allMeetings = result?.meetings || [];
  const refreshedAt = result?.refreshed_at ? new Date(result.refreshed_at).toLocaleTimeString("pl-PL") : null;

  // Okno dat: dziś + 14 dni dla wszystkich (zwiększone z 3)
  const today = useMemo(() => startOfDay(new Date()), []);
  const maxDate = useMemo(() => addDays(today, 14), [today]);
  const maxDateUser = useMemo(() => addDays(today, 14), [today]);

  // Ustal groupId bieżącego użytkownika
  const currentUserGroupId = useMemo(() => {
    if (!currentUser) return null;
    if (currentUser.role === "admin") return null;
    return currentUser.groupId || null;
  }, [currentUser]);

  // Ustal emaile zespołu team_leadera
  const teamMemberEmails = useMemo(() => {
    if (!currentUser || currentUser.role !== "team_leader") return [];
    const myAllowedUser = allAllowedUsers.find(u => (u.data?.email || u.email) === currentUser.email);
    const managedIds = myAllowedUser?.managed_users || myAllowedUser?.data?.managed_users || [];
    const emails = allAllowedUsers
      .filter(u => managedIds.includes(u.id))
      .map(u => u.data?.email || u.email);
    emails.push(currentUser.email);
    return emails;
  }, [currentUser, allAllowedUsers]);

  // Zwykły user widzi swoje przypisane spotkania
  const myAssignedMeetings = useMemo(() => {
    if (!currentUser || isLeaderOrAdmin) return [];
    return meetingAssignments
      .filter(a => a.assigned_user_email === currentUser.email)
      .filter(a => {
        if (!a.meeting_calendar) return true;
        const d = parseMeetingDate(a.meeting_calendar);
        if (!d) return true;
        const day = startOfDay(d);
        return day >= today && day <= maxDateUser;
      })
      .sort((a, b) => {
        const da = parseMeetingDate(a.meeting_calendar);
        const db = parseMeetingDate(b.meeting_calendar);
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return da - db;
      });
  }, [currentUser, isLeaderOrAdmin, meetingAssignments, today, maxDateUser]);

  // Handlowcy do przypisania: filtruj wg grupy dla liderów
  const salespeople = useMemo(() => {
    return allAllowedUsers
      .filter(u => {
        const role = u.data?.role || u.role;
        if (currentUser?.role === "admin") {
          return true;
        }
        if (role !== "user" && role !== "team_leader") return false;
        const uGroupId = u.data?.group_id || u.group_id;
        return uGroupId === currentUserGroupId;
      })
      .map(u => ({ email: u.data?.email || u.email, name: u.data?.name || u.name }));
  }, [allAllowedUsers, currentUser, currentUserGroupId]);

  // Filtruj: tylko z datą + w oknie 14 dni
  const meetingsWithDate = useMemo(() => {
    return allMeetings
      .filter(m => {
        if (!m.meeting_calendar) return false;
        const d = parseMeetingDate(m.meeting_calendar);
        if (!d) return false;
        const day = startOfDay(d);
        return day >= today && day <= maxDate;
      })
      .map(m => ({
        ...m,
        meeting_date: format(startOfDay(parseMeetingDate(m.meeting_calendar)), "yyyy-MM-dd"),
      }));
  }, [allMeetings, today, maxDate]);

  // Filtr wyszukiwania + grupy + arkusz + rola
  const filtered = useMemo(() => {
    return meetingsWithDate.filter(m => {
      const matchSearch = !search || Object.values(m).some(v =>
        String(v || "").toLowerCase().includes(search.toLowerCase())
      );
      let matchGroup = true;
      if (groupFilter !== "all") {
        const mapping = sheetMappings.find(sm => sm.sheet_name === m.sheet);
        matchGroup = mapping?.group_id === groupFilter;
      }
      const matchSheet = sheetFilter === "all" || m.sheet === sheetFilter;

      // Filtr wg roli
      let matchRole = true;
      if (currentUser?.role === "admin") {
        // Admin widzi WSZYSTKO
        matchRole = true;
      } else if (currentUser?.role === "group_leader") {
        if (currentUserGroupId) {
          const sheetMapping = sheetMappings.find(sm => sm.sheet_name === m.sheet);
          const isSheetInMyGroup = sheetMapping?.group_id === currentUserGroupId;
          const key = `${m.sheet}__${m.client_name}__${m.meeting_calendar}`;
          const assignment = meetingAssignments.find(a => a.meeting_key === key);
          const isAssignedToMyGroup = assignment?.assigned_group_id === currentUserGroupId;
          matchRole = isSheetInMyGroup || isAssignedToMyGroup;
        } else {
          matchRole = false;
        }
      } else if (currentUser?.role === "team_leader") {
        // Team leader widzi spotkania przypisane bezpośrednio do niego lub do członków jego zespołu
        const key = `${m.sheet}__${m.client_name}__${m.meeting_calendar}`;
        const assignment = meetingAssignments.find(a => a.meeting_key === key);
        if (assignment) {
          const isAssignedToMe = assignment.assigned_user_email === currentUser.email;
          const isAssignedToMyTeam = teamMemberEmails.includes(assignment.assigned_user_email);
          const isAssignedToMyGroup = currentUserGroupId && assignment.assigned_group_id === currentUserGroupId;
          matchRole = isAssignedToMe || isAssignedToMyTeam || isAssignedToMyGroup;
        } else {
          // Nieprzypisane spotkanie – team leader widzi je jeśli arkusz jest przypisany do jego grupy
          if (currentUserGroupId) {
            const sheetMapping = sheetMappings.find(sm => sm.sheet_name === m.sheet);
            matchRole = sheetMapping?.group_id === currentUserGroupId;
          } else {
            matchRole = false;
          }
        }
      }

      return matchSearch && matchGroup && matchSheet && matchRole;
    });
  }, [meetingsWithDate, search, groupFilter, sheetFilter, sheetMappings, currentUser, currentUserGroupId, meetingAssignments, teamMemberEmails]);

  // Grupuj po zakładce, potem po dacie
  const sheetGroups = useMemo(() => {
    const bySheet = {};
    filtered.forEach(m => {
      if (!bySheet[m.sheet]) bySheet[m.sheet] = {};
      if (!bySheet[m.sheet][m.meeting_date]) bySheet[m.sheet][m.meeting_date] = [];
      bySheet[m.sheet][m.meeting_date].push(m);
    });
    return Object.entries(bySheet).sort(([a], [b]) => a.localeCompare(b)).map(([sheet, byDate]) => ({
      sheet,
      dates: Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, meetings]) => ({ date, meetings })),
    }));
  }, [filtered]);

  const toggleSheet = (sheet) => {
    setExpandedSheets(prev => ({ ...prev, [sheet]: !prev[sheet] }));
  };

  // Domyślnie rozwiń pierwszy arkusz
  React.useEffect(() => {
    if (sheetGroups.length > 0) {
      setExpandedSheets(prev => {
        const next = { ...prev };
        if (Object.keys(prev).length === 0) {
          next[sheetGroups[0].sheet] = true;
        }
        return next;
      });
    }
  }, [sheetGroups.length]);

  const allSheetTabs = useMemo(() => {
    const allTabs = [...new Set(allMeetings.map(m => m.sheet).filter(Boolean))].sort();
    if (currentUser?.role === "group_leader" && currentUserGroupId) {
      const myGroupSheets = new Set(
        sheetMappings
          .filter(sm => sm.group_id === currentUserGroupId)
          .map(sm => sm.sheet_name)
      );
      // Dodaj też arkusze z przypisań do grupy
      meetingAssignments
        .filter(a => a.assigned_group_id === currentUserGroupId && a.sheet)
        .forEach(a => myGroupSheets.add(a.sheet));
      return allTabs.filter(s => myGroupSheets.has(s));
    }
    return allTabs;
  }, [allMeetings, currentUser, currentUserGroupId, sheetMappings, meetingAssignments]);

  if (!accessChecked) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-7 h-7 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Zwykły użytkownik widzi tylko swoje przypisane spotkania – z pełnymi szczegółami
  if (!isLeaderOrAdmin) {
    return (
      <UserMeetingsView
        myAssignedMeetings={myAssignedMeetings}
        selectedDetails={selectedDetails}
        setSelectedDetails={setSelectedDetails}
        detailsModalOpen={detailsModalOpen}
        setDetailsModalOpen={setDetailsModalOpen}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Spotkania"
        subtitle={`Spotkania z datą – najbliższe 14 dni`}
      />

      {/* Statystyki przypisań – tylko admin */}
      {currentUser?.role === "admin" && showStats && (
        <AssignmentStats onClose={() => setShowStats(false)} />
      )}

      {/* Pasek narzędzi */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Szukaj klienta, agenta, adresu..."
            className="pl-10 h-11"
          />
        </div>

        {currentUser?.role === "admin" && groups.length > 0 && (
          <Select value={groupFilter} onValueChange={setGroupFilter}>
            <SelectTrigger className="w-48 h-11">
              <SelectValue placeholder="Wszystkie grupy" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie grupy</SelectItem>
              {groups.map(g => (
                <SelectItem key={g.id} value={g.id}>
                  {g.data?.name || g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {isAdminOrGroupLeader && allSheetTabs.length > 0 && (
          <Select value={sheetFilter} onValueChange={setSheetFilter}>
            <SelectTrigger className="w-52 h-11">
              <SelectValue placeholder="Wszystkie arkusze" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                Wszystkie arkusze ({meetingsWithDate.length})
              </SelectItem>
              {allSheetTabs.map(sheet => {
                const count = meetingsWithDate.filter(m => m.sheet === sheet).length;
                return (
                  <SelectItem key={sheet} value={sheet}>
                    {sheet} ({count})
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        )}

        {currentUser?.role === "admin" && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 h-11"
            onClick={() => setShowMappingPanel(p => !p)}
          >
            <Settings2 className="w-4 h-4" />
            Przypisz arkusze
          </Button>
        )}

        {currentUser?.role === "admin" && (
          <Button
            variant={showStats ? "default" : "outline"}
            size="sm"
            className="gap-2 h-11"
            onClick={() => setShowStats(p => !p)}
          >
            <BarChart2 className="w-4 h-4" />
            Statystyki
          </Button>
        )}

        {isAdminOrGroupLeader && filtered.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 h-11 border-orange-200 text-orange-600 hover:bg-orange-50"
            disabled={notifySending}
            onClick={async () => {
              setNotifySending(true);
              const groupId = currentUser.role === "group_leader" ? currentUserGroupId : null;
              await base44.functions.invoke("notifyGroupLeaderNewMeetings", groupId ? { groupId } : {});
              setNotifySending(false);
              alert("Powiadomienia zostały wysłane!");
            }}
          >
            <Bell className={`w-4 h-4 ${notifySending ? "animate-pulse" : ""}`} />
            {notifySending ? "Wysyłanie..." : "Wyślij powiadomienia"}
          </Button>
        )}

        <div className="flex flex-col items-end gap-1 shrink-0">
          <Button onClick={() => refetch()} variant="outline" className="gap-2 h-11" disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            Odśwież
          </Button>
          {refreshedAt && (
            <span className="text-[10px] text-gray-400">Aktualizacja: {refreshedAt}</span>
          )}
        </div>
      </div>

      {/* Panel przypisań arkuszy */}
      <AnimatePresence>
        {showMappingPanel && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <SheetMappingPanel groups={groups} onClose={() => setShowMappingPanel(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Licznik */}
      {!isLoading && (
        <div className="text-sm text-gray-500">
          Pokazano <span className="font-semibold text-gray-800">{filtered.length}</span> spotkań z datą (maks. +14 dni od dziś)
          {allMeetings.length > 0 && <span className="ml-1 text-gray-400">z {allMeetings.length} wszystkich</span>}
        </div>
      )}

      {/* Zawartość */}
      {isLoading || (isFetching && allMeetings.length === 0) ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Table2 className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="font-semibold text-gray-800 mb-1">Brak spotkań</h3>
          <p className="text-sm text-gray-500 max-w-sm">
            Nie ma żadnych spotkań z wypełnioną datą w ciągu najbliższych 14 dni.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sheetGroups.map(({ sheet, dates }) => {
            const isOpen = expandedSheets[sheet] !== false && expandedSheets[sheet] !== undefined
              ? expandedSheets[sheet]
              : false;
            const total = dates.reduce((acc, d) => acc + d.meetings.length, 0);

            return (
              <div key={sheet} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                {/* Nagłówek arkusza */}
                <button
                  onClick={() => toggleSheet(sheet)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800 text-sm">{sheet}</span>
                    <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px]">
                      {total} spotkań
                    </Badge>
                    {(() => {
                      const mapping = sheetMappings.find(sm => sm.sheet_name === sheet);
                      return mapping?.group_name ? (
                        <Badge className="bg-green-50 text-green-700 border-green-200 text-[10px]">
                          {mapping.group_name}
                        </Badge>
                      ) : null;
                    })()}
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="p-3 space-y-4">
                        {dates.map(({ date, meetings }) => (
                          <div key={date}>
                            <div className="flex items-center gap-2 mb-2 px-1">
                              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                {formatDateLabel(meetings[0].meeting_calendar)}
                              </span>
                              <div className="flex-1 h-px bg-gray-200" />
                              <Badge variant="outline" className="text-[10px] text-gray-500">
                                {meetings.length} spotkań
                              </Badge>
                            </div>
                            <div className="space-y-2">
                              {meetings.map((meeting, i) => {
                                const key = `${meeting.sheet}__${meeting.client_name}__${meeting.meeting_calendar}`;
                                const assignment = meetingAssignments.find(a => a.meeting_key === key);
                                return (
                                  <div key={i} className="flex gap-2 items-start">
                                    {(assignment?.comments || assignment?.agent || meeting.agent || meeting.interview_data) && (
                                      <button
                                        onClick={() => {
                                           setSelectedDetails({
                                             agent: meeting.agent || assignment?.agent,
                                             comments: assignment?.comments || meeting.comments,
                                             interview_data: meeting.interview_data || {}
                                           });
                                           setDetailsModalOpen(true);
                                         }}
                                        className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 hover:text-blue-700 transition-colors shrink-0 mt-0.5"
                                        title="Pokaż szczegóły"
                                      >
                                        <MessageSquare className="w-4 h-4" />
                                      </button>
                                    )}
                                    <div className="flex-1">
                                      <MeetingCard
                                       meeting={meeting}
                                       assignment={assignment}
                                       salespeople={salespeople}
                                       assignmentsForDate={meetingAssignments.filter(a => a.meeting_date === meeting.meeting_date)}
                                       currentUserRole={currentUser?.role}
                                       meetingReports={meetingReports}
                                       groups={groups}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      <DetailsModal
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
        data={selectedDetails}
      />
    </div>
  );
}