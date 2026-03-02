import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Search, AlertCircle, Table2, ChevronDown, ChevronUp, Settings2 } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { motion, AnimatePresence } from "framer-motion";
import SheetMappingPanel from "@/components/meetings/SheetMappingPanel";
import MeetingCard from "@/components/meetings/MeetingCard";
import { format, addDays, parseISO, isValid, startOfDay } from "date-fns";

// Parsuje daty w różnych formatach polskich: "DD.MM.YYYY HH:MM", "DD.MM.YYYY", itp.
function parseMeetingDate(str) {
  if (!str) return null;
  // Try DD.MM.YYYY HH:MM or DD.MM.YYYY
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

export default function Meetings() {
  const [currentUser, setCurrentUser] = useState(null);
  const [accessChecked, setAccessChecked] = useState(false);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [expandedSheets, setExpandedSheets] = useState({});
  const [showMappingPanel, setShowMappingPanel] = useState(false);

  React.useEffect(() => {
    const fetchUser = async () => {
      const user = await base44.auth.me();
      const allowedUsers = await base44.entities.AllowedUser.list();
      const ua = allowedUsers.find(a => (a.data?.email || a.email) === user.email);
      if (ua) {
        user.role = ua.data?.role || ua.role;
        user.displayName = ua.data?.name || ua.name;
        user.groupId = ua.data?.group_id || ua.group_id;
      }
      setCurrentUser(user);
      setAccessChecked(true);
    };
    fetchUser();
  }, []);

  const isLeaderOrAdmin = currentUser?.role === "admin" || currentUser?.role === "group_leader" || currentUser?.role === "team_leader";

  const { data: groups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: () => base44.entities.Group.list(),
    enabled: accessChecked && isLeaderOrAdmin,
  });

  const { data: sheetMappings = [] } = useQuery({
    queryKey: ["sheetMappings"],
    queryFn: () => base44.entities.SheetGroupMapping.list(),
    enabled: accessChecked && isLeaderOrAdmin,
  });

  const { data: allAllowedUsers = [] } = useQuery({
    queryKey: ["allowedUsers"],
    queryFn: () => base44.entities.AllowedUser.list(),
    enabled: accessChecked && isLeaderOrAdmin,
  });

  const { data: meetingAssignments = [] } = useQuery({
    queryKey: ["meetingAssignments"],
    queryFn: () => base44.entities.MeetingAssignment.list(),
    enabled: accessChecked && isLeaderOrAdmin,
  });

  const { data: result, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["sheetMeetings"],
    queryFn: () => base44.functions.invoke("getMeetingsFromSheets").then(r => r.data),
    enabled: accessChecked && isLeaderOrAdmin,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const allMeetings = result?.meetings || [];
  const refreshedAt = result?.refreshed_at ? new Date(result.refreshed_at).toLocaleTimeString("pl-PL") : null;

  // Handlowcy do przypisania: wszyscy z role=user lub team_leader
  const salespeople = useMemo(() => {
    return allAllowedUsers
      .filter(u => {
        const role = u.data?.role || u.role;
        return role === "user" || role === "team_leader";
      })
      .map(u => ({ email: u.data?.email || u.email, name: u.data?.name || u.name }));
  }, [allAllowedUsers]);

  // Okno dat: dziś + 3 dni
  const today = startOfDay(new Date());
  const maxDate = addDays(today, 3);

  // Filtruj: tylko z datą + w oknie 3 dni
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
  }, [allMeetings]);

  // Filtr wyszukiwania + grupy
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
      return matchSearch && matchGroup;
    });
  }, [meetingsWithDate, search, groupFilter, sheetMappings]);

  // Grupuj po zakładce, potem po dacie
  const sheetGroups = useMemo(() => {
    const bySheet = {};
    filtered.forEach(m => {
      if (!bySheet[m.sheet]) bySheet[m.sheet] = {};
      if (!bySheet[m.sheet][m.meeting_date]) bySheet[m.sheet][m.meeting_date] = [];
      bySheet[m.sheet][m.meeting_date].push(m);
    });
    // Posortuj daty wewnątrz każdego arkusza
    const result = Object.entries(bySheet).sort(([a], [b]) => a.localeCompare(b)).map(([sheet, byDate]) => ({
      sheet,
      dates: Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, meetings]) => ({ date, meetings })),
    }));
    return result;
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
    return [...new Set(allMeetings.map(m => m.sheet).filter(Boolean))].sort();
  }, [allMeetings]);

  if (!accessChecked) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-7 h-7 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isLeaderOrAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
        <p className="text-gray-700 font-medium">Brak dostępu – tylko dla liderów i administratorów</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Spotkania"
        subtitle={`Spotkania z datą – najbliższe 3 dni`}
      />

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

        {groups.length > 0 && (
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
            <SheetMappingPanel sheetTabs={allSheetTabs} groups={groups} onClose={() => setShowMappingPanel(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Licznik */}
      {!isLoading && (
        <div className="text-sm text-gray-500">
          Pokazano <span className="font-semibold text-gray-800">{filtered.length}</span> spotkań z datą (maks. +3 dni od dziś)
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
            Nie ma żadnych spotkań z wypełnioną datą w ciągu najbliższych 3 dni.
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
                            {/* Nagłówek dnia */}
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
                                  <MeetingCard
                                    key={i}
                                    meeting={meeting}
                                    assignment={assignment}
                                    salespeople={salespeople}
                                    assignmentsForDate={meetingAssignments.filter(a => a.meeting_date === meeting.meeting_date)}
                                    currentUserRole={currentUser?.role}
                                  />
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
    </div>
  );
}