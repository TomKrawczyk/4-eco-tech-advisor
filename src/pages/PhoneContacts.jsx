import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import useCurrentUser from "@/components/shared/useCurrentUser";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Search, AlertCircle, Phone, ChevronDown, ChevronUp, User, MessageSquare, BarChart2 } from "lucide-react";
import AssignmentStats from "@/components/meetings/AssignmentStats";
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
  const [showStats, setShowStats] = useState(false);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    const fetchUser = async () => {
      const user = await base44.auth.me();
      const [allowedUsers, groups] = await Promise.all([
        base44.entities.AllowedUser.list(),
        base44.entities.Group.list(),
      ]);
      const ua = allowedUsers.find(a => (a.data?.email || a.email) === user.email);
      if (ua) {
        user.role = ua.data?.role || ua.role;
        user.displayName = ua.data?.name || ua.name;
        let groupId = ua.data?.group_id || ua.group_id;
        if (!groupId && (user.role === "group_leader" || user.role === "team_leader")) {
          const myGroup = groups.find(g => {
            const ids = g.data?.group_leader_ids || g.group_leader_ids || [];
            return ids.includes(ua.id);
          });
          groupId = myGroup?.id || null;
        }
        user.groupId = groupId;
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
    enabled: accessChecked,
  });

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

  // Zawsze pobieramy przypisania z bazy - potrzebne dla każdej roli
  const { data: phoneContactsFromDB = [] } = useQuery({
    queryKey: ["phoneContactsDB"],
    queryFn: () => base44.entities.PhoneContact.list(),
    enabled: accessChecked,
  });

  const { data: rawContacts = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["phoneContacts"],
    queryFn: () => base44.functions.invoke('getMeetingsFromSheets'),
    select: (response) => {
      const all = response.data?.phoneContacts || [];
      return all.filter(c => 
        !c.sheet?.toLowerCase().includes('spotkania') && 
        !c.sheet?.toLowerCase().includes('kontakt') && 
        !c.sheet?.toLowerCase().includes('ai bober')
      );
    },
    enabled: accessChecked && isLeaderOrAdmin,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  // Scal dane z arkusza z przypisaniami z bazy
  const contacts = useMemo(() => {
    if (!isLeaderOrAdmin) return [];
    return rawContacts.map(c => {
      const dbRecord = phoneContactsFromDB.find(db => db.contact_key === c.contact_key);
      if (dbRecord) {
        return {
          ...c,
          id: dbRecord.id,
          assigned_user_email: dbRecord.assigned_user_email || c.assigned_user_email,
          assigned_user_name: dbRecord.assigned_user_name || c.assigned_user_name,
          assigned_group_id: dbRecord.assigned_group_id || c.assigned_group_id,
          assigned_group_name: dbRecord.assigned_group_name || c.assigned_group_name,
        };
      }
      return c;
    });
  }, [rawContacts, phoneContactsFromDB, isLeaderOrAdmin]);

  const upsertContact = async (contact, patch) => {
    const existing = phoneContactsFromDB.find(db => db.contact_key === contact.contact_key);
    if (existing) {
      return base44.entities.PhoneContact.update(existing.id, patch);
    } else {
      return base44.entities.PhoneContact.create({
        contact_key: contact.contact_key,
        sheet: contact.sheet,
        client_name: contact.client_name,
        phone: contact.phone,
        address: contact.address,
        date: contact.date,
        agent: contact.agent,
        contact_date: contact.contact_date,
        status: contact.status,
        comments: contact.comments,
        ...patch,
      });
    }
  };

  const assignMutation = useMutation({
    mutationFn: ({ contact, email, name }) => upsertContact(contact, { assigned_user_email: email, assigned_user_name: name }),
    onSuccess: (savedRecord, variables) => {
      queryClient.setQueryData(["phoneContactsDB"], (old = []) => {
        const exists = old.find(db => db.contact_key === variables.contact.contact_key);
        if (exists) {
          return old.map(db => db.contact_key === variables.contact.contact_key
            ? { ...db, assigned_user_email: variables.email, assigned_user_name: variables.name }
            : db
          );
        }
        return [...old, { ...savedRecord, contact_key: variables.contact.contact_key }];
      });
      if (variables.email) {
        base44.functions.invoke("notifyContactAssigned", {
          assignedUserEmail: variables.email,
          assignedUserName: variables.name,
          clientName: variables.contact.client_name,
          phone: variables.contact.phone,
          sheet: variables.contact.sheet,
        }).catch(() => {});
      }
    },
  });

  const assignGroupMutation = useMutation({
    mutationFn: ({ contact, groupId, groupName }) => upsertContact(contact, { assigned_group_id: groupId, assigned_group_name: groupName }),
    onSuccess: (savedRecord, variables) => {
      queryClient.setQueryData(["phoneContactsDB"], (old = []) => {
        const exists = old.find(db => db.contact_key === variables.contact.contact_key);
        if (exists) {
          return old.map(db => db.contact_key === variables.contact.contact_key
            ? { ...db, assigned_group_id: variables.groupId, assigned_group_name: variables.groupName }
            : db
          );
        }
        return [...old, { ...savedRecord, contact_key: variables.contact.contact_key }];
      });
      if (variables.groupId) {
        base44.functions.invoke("notifyGroupLeaderNewContacts", {
          groupId: variables.groupId,
          groupName: variables.groupName,
          clientName: variables.contact.client_name,
          phone: variables.contact.phone,
          sheet: variables.contact.sheet,
        }).catch(() => {});
      }
    },
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

  // Filtr hierarchiczny: group_leader widzi kontakty z arkuszy przypisanych do jego grupy
  const visibleContacts = useMemo(() => {
    if (currentUser?.role === "admin") return contacts;
    if (currentUser?.role === "group_leader") {
      const myGroupId = currentUser?.groupId;
      // Kontakty z arkuszy przypisanych do grupy group_leadera
      return contacts.filter(c => {
        const sheetMapping = sheetMappings.find(sm => sm.sheet_name === c.sheet);
        if (sheetMapping) return sheetMapping.group_id === myGroupId;
        // Fallback: kontakty bezpośrednio przypisane do grupy lub do użytkownika z grupy
        const userGroupId = allAllowedUsers.find(u => (u.data?.email || u.email) === c.assigned_user_email);
        const uGroupId = userGroupId?.data?.group_id || userGroupId?.group_id;
        return c.assigned_group_id === myGroupId || uGroupId === myGroupId;
      });
    }
    if (currentUser?.role === "team_leader") {
      const myAllowedUser = allAllowedUsers.find(u => (u.data?.email || u.email) === currentUser?.email);
      const managedIds = myAllowedUser?.managed_users || myAllowedUser?.data?.managed_users || [];
      const managedEmails = allAllowedUsers
        .filter(u => managedIds.includes(u.id))
        .map(u => u.data?.email || u.email);
      managedEmails.push(currentUser.email);
      // Team leader widzi kontakty z arkuszy przypisanych do jego grupy LUB przypisane do jego podległych
      const myGroupId = currentUser?.groupId;
      return contacts.filter(c => {
        const sheetMapping = sheetMappings.find(sm => sm.sheet_name === c.sheet);
        if (sheetMapping && myGroupId && sheetMapping.group_id === myGroupId) return true;
        return !c.assigned_user_email || managedEmails.includes(c.assigned_user_email);
      });
    }
    return contacts;
  }, [contacts, currentUser, allAllowedUsers, sheetMappings]);

  const filtered = useMemo(() => {
    return visibleContacts.filter(c => {
      const matchSearch = !search || Object.values(c).some(v => String(v || "").toLowerCase().includes(search.toLowerCase()));
      const matchSheet = sheetFilter === "all" || c.sheet === sheetFilter;
      const matchStatus = c.status === "Kontakt do doradcy" || c.status === "DWS";
      return matchSearch && matchSheet && matchStatus;
    });
  }, [visibleContacts, search, sheetFilter]);

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

  // Zwykły użytkownik widzi swoje przypisane kontakty lub te przypisane do jego grupy
  if (!isLeaderOrAdmin) {
    const myGroupId = currentUser?.groupId;
    const myContacts = phoneContactsFromDB.filter(c =>
      c.assigned_user_email === currentUser?.email ||
      (myGroupId && c.assigned_group_id === myGroupId)
    );
    return (
      <div className="space-y-6">
        <PageHeader title="Moje kontakty telefoniczne" subtitle="Kontakty przypisane do Ciebie" />
        {myContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Phone className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-800 mb-1">Brak przypisanych kontaktów</h3>
            <p className="text-sm text-gray-500">Nie masz jeszcze żadnych przypisanych kontaktów telefonicznych.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {myContacts.map((c, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="font-semibold text-gray-900 text-sm">{c.client_name}</div>
                {c.phone && (
                  <a href={`tel:${c.phone}`} className="text-xs text-green-600 hover:underline flex items-center gap-1 mt-1">
                    <Phone className="w-3 h-3" /> {c.phone}
                  </a>
                )}
                {c.address && <div className="text-xs text-gray-500 mt-0.5">{c.address}</div>}
                <div className="flex flex-wrap gap-1 mt-1">
                  {c.sheet && <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px]">{c.sheet}</Badge>}
                  {c.assigned_group_name && !c.assigned_user_email && (
                    <Badge className="bg-purple-50 text-purple-700 border border-purple-200 text-[10px]">Grupa: {c.assigned_group_name}</Badge>
                  )}
                </div>
                {(c.comments || c.agent) && (
                  <button
                    onClick={() => { setSelectedDetails({ agent: c.agent, comments: c.comments, interview_data: c.interview_data || {} }); setDetailsModalOpen(true); }}
                    className="mt-2 px-2 py-1 rounded text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                  >
                    Szczegóły
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <DetailsModal open={detailsModalOpen} onOpenChange={setDetailsModalOpen} data={selectedDetails} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Kontakt telefoniczny do doradcy" subtitle="Klienci zainteresowani kontaktem z doradcą – aktualizacja co 5 minut" />

      {currentUser?.role === "admin" && showStats && (
        <AssignmentStats onClose={() => setShowStats(false)} />
      )}

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
                                              onClick={() => assignMutation.mutate({ contact, email: "", name: "" })}
                                              className="ml-1 text-gray-400 hover:text-red-500 text-xs"
                                            >×</button>
                                          )}
                                        </div>
                                      ) : (
                                        <Select onValueChange={(val) => {
                                          const sp = salespeople.find(s => s.email === val);
                                          if (sp) assignMutation.mutate({ contact, email: sp.email, name: sp.name });
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
                                                onClick={() => assignGroupMutation.mutate({ contact, groupId: "", groupName: "" })}
                                                className="ml-1 text-gray-400 hover:text-red-500 text-xs"
                                              >×</button>
                                            </div>
                                          ) : (
                                            <Select onValueChange={(val) => {
                                              const g = groups.find(gr => gr.id === val);
                                              if (g) assignGroupMutation.mutate({ contact, groupId: g.id, groupName: g.name });
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