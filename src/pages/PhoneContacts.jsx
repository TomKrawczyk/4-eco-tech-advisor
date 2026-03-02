import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Search, AlertCircle, Phone, ChevronDown, ChevronUp, User, MessageSquare } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import DetailsModal from "@/components/shared/DetailsModal";
import { motion, AnimatePresence } from "framer-motion";
import { format, addDays, isValid, startOfDay } from "date-fns";

function parseDateStr(str) {
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

function formatDateLabel(str) {
  const today = startOfDay(new Date());
  const d = parseDateStr(str);
  if (!d) return str || "Brak daty";
  const diff = Math.round((startOfDay(d) - today) / 86400000);
  const dayName = d.toLocaleDateString("pl-PL", { weekday: "long" });
  const dateFormatted = d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
  if (diff === 0) return `Dziś (${dateFormatted})`;
  if (diff === 1) return `Jutro (${dateFormatted})`;
  return `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} (${dateFormatted})`;
}

export default function PhoneContacts() {
  const [currentUser, setCurrentUser] = useState(null);
  const [accessChecked, setAccessChecked] = useState(false);
  const [search, setSearch] = useState("");
  const [sheetFilter, setSheetFilter] = useState("all");
  const [expandedSheets, setExpandedSheets] = useState({});
  const [selectedDetails, setSelectedDetails] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
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
      }
      setCurrentUser(user);
      setAccessChecked(true);
    };
    fetchUser();
  }, []);

  const isLeaderOrAdmin = currentUser?.role === "admin" || currentUser?.role === "group_leader" || currentUser?.role === "team_leader";

  const { data: allAllowedUsers = [] } = useQuery({
    queryKey: ["allowedUsers"],
    queryFn: () => base44.entities.AllowedUser.list(),
    enabled: accessChecked && isLeaderOrAdmin,
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: () => base44.entities.Group.list(),
    enabled: accessChecked && isLeaderOrAdmin,
  });

  const { data: contacts = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["phoneContacts"],
    queryFn: () => base44.functions.invoke('getMeetingsFromSheets'),
    select: (response) => {
      const all = response.data?.phoneContacts || [];
      // Filtruj tylko kontakty – wyłącz archusze z tytułem zawierającym "Spotkania" lub "Ai Bober"
      return all.filter(c => 
        !c.sheet?.toLowerCase().includes('spotkania') && 
        !c.sheet?.toLowerCase().includes('ai bober')
      );
    },
    enabled: accessChecked && isLeaderOrAdmin,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, email, name }) =>
      base44.entities.PhoneContact.update(id, { assigned_user_email: email, assigned_user_name: name }),
    onSuccess: () => queryClient.invalidateQueries(["phoneContacts"]),
  });

  const assignGroupMutation = useMutation({
    mutationFn: ({ id, groupId, groupName }) =>
      base44.entities.PhoneContact.update(id, { assigned_group_id: groupId, assigned_group_name: groupName }),
    onSuccess: () => queryClient.invalidateQueries(["phoneContacts"]),
  });

  // Handlowcy do przypisania
  const salespeople = useMemo(() => {
    return allAllowedUsers
      .filter(u => {
        const role = u.data?.role || u.role;
        return role === "user" || role === "team_leader";
      })
      .map(u => ({ email: u.data?.email || u.email, name: u.data?.name || u.name }));
  }, [allAllowedUsers]);

  const allSheetTabs = useMemo(() => [...new Set(contacts.map(c => c.sheet).filter(Boolean))].sort(), [contacts]);

  const filtered = useMemo(() => {
    return contacts.filter(c => {
      const matchSearch = !search || Object.values(c).some(v => String(v || "").toLowerCase().includes(search.toLowerCase()));
      const matchSheet = sheetFilter === "all" || c.sheet === sheetFilter;
      const matchStatus = c.status === "Kontakt do doradcy";
      return matchSearch && matchSheet && matchStatus;
    });
  }, [contacts, search, sheetFilter]);

  // Grupuj po zakładce, potem po dacie
  const sheetGroups = useMemo(() => {
    const bySheet = {};
    filtered.forEach(c => {
      const sheet = c.sheet || "Brak zakładki";
      const dateKey = c.contact_date || "no-date";
      if (!bySheet[sheet]) bySheet[sheet] = {};
      if (!bySheet[sheet][dateKey]) bySheet[sheet][dateKey] = [];
      bySheet[sheet][dateKey].push(c);
    });
    return Object.entries(bySheet).sort(([a], [b]) => a.localeCompare(b)).map(([sheet, byDate]) => ({
      sheet,
      dates: Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, items]) => ({ date, items })),
    }));
  }, [filtered]);

  const toggleSheet = (sheet) => setExpandedSheets(prev => ({ ...prev, [sheet]: !prev[sheet] }));

  React.useEffect(() => {
    if (sheetGroups.length > 0) {
      setExpandedSheets(prev => {
        if (Object.keys(prev).length === 0) return { [sheetGroups[0].sheet]: true };
        return prev;
      });
    }
  }, [sheetGroups.length]);

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
      <PageHeader title="Kontakt telefoniczny do doradcy" subtitle="Klienci zainteresowani kontaktem z doradcą – aktualizacja co 5 minut" />

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Szukaj klienta, telefonu, adresu..." className="pl-10 h-11" />
        </div>

        {allSheetTabs.length > 0 && (
          <Select value={sheetFilter} onValueChange={setSheetFilter}>
            <SelectTrigger className="w-52 h-11">
              <SelectValue placeholder="Wszystkie arkusze" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie arkusze ({contacts.length})</SelectItem>
              {allSheetTabs.map(sheet => (
                <SelectItem key={sheet} value={sheet}>{sheet} ({contacts.filter(c => c.sheet === sheet).length})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button onClick={() => refetch()} variant="outline" className="gap-2 h-11" disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          Odśwież
        </Button>
      </div>

      <div className="text-sm text-gray-500">
        Pokazano <span className="font-semibold text-gray-800">{filtered.length}</span> kontaktów
      </div>

      {isLoading ? (
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
            <Phone className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="font-semibold text-gray-800 mb-1">Brak kontaktów</h3>
          <p className="text-sm text-gray-500 max-w-sm">Brak klientów zainteresowanych kontaktem z doradcą w arkuszu.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sheetGroups.map(({ sheet, dates }) => {
            const isOpen = expandedSheets[sheet] ?? false;
            const total = dates.reduce((acc, d) => acc + d.items.length, 0);
            return (
              <div key={sheet} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                <button
                  onClick={() => toggleSheet(sheet)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800 text-sm">{sheet}</span>
                    <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px]">{total} kontaktów</Badge>
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
                        {dates.map(({ date, items }) => (
                          <div key={date}>
                            <div className="flex items-center gap-2 mb-2 px-1">
                              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                {date !== "no-date" ? formatDateLabel(items[0].contact_calendar || date) : "Brak daty"}
                              </span>
                              <div className="flex-1 h-px bg-gray-200" />
                              <Badge variant="outline" className="text-[10px] text-gray-500">{items.length}</Badge>
                            </div>
                            <div className="space-y-2">
                              {items.map((contact, i) => (
                                <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="font-medium text-gray-800 text-sm truncate">{contact.client_name}</div>
                                      {contact.phone && (
                                        <a href={`tel:${contact.phone}`} className="text-xs text-green-600 hover:underline flex items-center gap-1 mt-0.5">
                                          <Phone className="w-3 h-3" /> {contact.phone}
                                        </a>
                                      )}
                                      {contact.address && <div className="text-xs text-gray-500 mt-0.5">{contact.address}</div>}
                                      {contact.status && (
                                        <Badge className="mt-1 bg-orange-50 text-orange-700 border-orange-200 text-[10px]">{contact.status}</Badge>
                                      )}
                                    </div>
                                    <div className="shrink-0 flex gap-2 flex-wrap">
                                      <button
                                        onClick={() => {
                                          setSelectedDetails({
                                            agent: contact.agent,
                                            comments: contact.comments,
                                            interview_data: contact.interview_data || {}
                                          });
                                          setDetailsModalOpen(true);
                                        }}
                                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                        title="Pokaż szczegóły"
                                      >
                                        Szczegóły
                                      </button>

                                      {contact.assigned_user_email ? (
                                        <div className="flex items-center gap-1.5 bg-green-50 rounded-lg px-2 py-1">
                                          <User className="w-3 h-3 text-green-600" />
                                          <span className="text-xs font-medium text-green-700">{contact.assigned_user_name || contact.assigned_user_email}</span>
                                          {(currentUser?.role === "admin" || currentUser?.role === "group_leader" || currentUser?.role === "team_leader") && (
                                            <button
                                              onClick={() => assignMutation.mutate({ id: contact.id, email: "", name: "" })}
                                              className="ml-1 text-gray-400 hover:text-red-500 text-xs"
                                            >×</button>
                                          )}
                                        </div>
                                      ) : (
                                        <Select onValueChange={(val) => {
                                          const sp = salespeople.find(s => s.email === val);
                                          if (sp) assignMutation.mutate({ id: contact.id, email: sp.email, name: sp.name });
                                        }}>
                                          <SelectTrigger className="h-8 text-xs flex-1 min-w-[140px]">
                                            <SelectValue placeholder="Przypisz doradcę" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {salespeople.map(sp => (
                                              <SelectItem key={sp.email} value={sp.email}>{sp.name}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      )}

                                      {(currentUser?.role === "group_leader" || currentUser?.role === "team_leader" || currentUser?.role === "admin") && (
                                        <>
                                          {contact.assigned_group_id ? (
                                            <div className="flex items-center gap-1.5 bg-blue-50 rounded-lg px-2 py-1">
                                              <span className="text-xs font-medium text-blue-700">{contact.assigned_group_name}</span>
                                              <button
                                                onClick={() => assignGroupMutation.mutate({ id: contact.id, groupId: "", groupName: "" })}
                                                className="ml-1 text-gray-400 hover:text-red-500 text-xs"
                                              >×</button>
                                            </div>
                                          ) : (
                                            <Select onValueChange={(val) => {
                                              const g = groups.find(gr => gr.id === val);
                                              if (g) assignGroupMutation.mutate({ id: contact.id, groupId: g.id, groupName: g.name });
                                            }}>
                                              <SelectTrigger className="h-8 text-xs flex-1 min-w-[140px]">
                                                <SelectValue placeholder="Przypisz grupę" />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {groups.map(g => (
                                                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
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