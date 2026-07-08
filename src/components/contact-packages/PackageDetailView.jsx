import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Search, UserCheck, CheckSquare, Square,
  RotateCcw, Pencil, Check, X, MessageSquare, Calendar, Clock, Upload, Archive, ArchiveRestore
} from "lucide-react";
import PackageImportModal from "@/components/contact-packages/PackageImportModal";
import ScheduleMeetingModal from "@/components/contact-packages/ScheduleMeetingModal";

const STATUS_LABELS = {
  unassigned: "Nieprzypisany",
  assigned: "Przypisany",
  contacted: "Skontaktowany",
  interested: "Zainteresowany",
  not_interested: "Niezainteresowany",
  no_answer: "Brak odpowiedzi",
  callback: "Do ponownego kontaktu",
  meeting_scheduled: "Spotkanie umówione",
  contract_signed: "Umowa podpisana",
};

const STATUS_COLORS = {
  unassigned: "bg-gray-100 text-gray-600",
  assigned: "bg-blue-50 text-blue-700",
  contacted: "bg-yellow-50 text-yellow-700",
  interested: "bg-green-50 text-green-700",
  not_interested: "bg-red-50 text-red-700",
  no_answer: "bg-orange-50 text-orange-700",
  callback: "bg-cyan-50 text-cyan-700",
  meeting_scheduled: "bg-purple-50 text-purple-700",
  contract_signed: "bg-emerald-100 text-emerald-800",
};

export default function PackageDetailView({ pkg, currentUser, onBack, onPackageUpdated }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState(new Set());
  const [expandedLeadId, setExpandedLeadId] = useState(null);
  const [assignTarget, setAssignTarget] = useState("");
  const [assignDropdown, setAssignDropdown] = useState(false);
  const [editingGroup, setEditingGroup] = useState(false);
  const [newGroupId, setNewGroupId] = useState(pkg.group_id || "");
  const [showAppendImport, setShowAppendImport] = useState(false);
  const [archiveTab, setArchiveTab] = useState("active");
  const [sortMode, setSortMode] = useState("created");
  const [leadDrafts, setLeadDrafts] = useState({});
  const [meetingLead, setMeetingLead] = useState(null);

  const isAdmin = currentUser?.role === "admin";

  // Synchronizuj newGroupId gdy pkg się zmieni (po zapisie przez rodzica)
  useEffect(() => {
    setNewGroupId(pkg.group_id || "");
  }, [pkg.group_id]);

  // Wszystkie leady w tej paczce
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads", pkg.id],
    queryFn: () => base44.entities.ContactLead.filter({ package_id: pkg.id }),
  });

  // Użytkownicy do przypisania — pobieramy pełną listę, żeby uwzględnić też liderów grupy
  const { data: allUsers = [] } = useQuery({
    queryKey: ["allowed-users-assign", pkg.group_id],
    queryFn: () => base44.entities.AllowedUser.list(),
  });

  const { data: allGroups = [] } = useQuery({
    queryKey: ["groups-all"],
    queryFn: () => base44.entities.Group.list(),
  });

  const updateGroupMutation = useMutation({
    mutationFn: (groupId) => {
      const g = allGroups.find(g => g.id === groupId);
      const patch = { group_id: groupId || "", group_name: g?.name || "" };
      return base44.entities.ContactPackage.update(pkg.id, patch);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contact-packages"] });
      setEditingGroup(false);
      if (onPackageUpdated) onPackageUpdated();
    },
  });

  const currentGroup = allGroups.find(g => g.id === pkg.group_id);
  const groupLeaderIds = currentGroup?.group_leader_ids || currentGroup?.data?.group_leader_ids || [];
  const groupLeaderId = currentGroup?.group_leader_id || currentGroup?.data?.group_leader_id;
  const allowedGroupLeaderIds = new Set([groupLeaderId, ...groupLeaderIds].filter(Boolean));

  const assignableUsers = allUsers
    .map(u => ({
      id: u.id,
      email: u.email || u.data?.email,
      name: u.name || u.data?.name || u.email || u.data?.email,
      role: u.role || u.data?.role,
      group_id: u.group_id || u.data?.group_id,
    }))
    .filter(u => {
      if (!u.email) return false;
      if (u.role === "advisor" || u.role === "team_leader") return u.group_id === pkg.group_id;
      if (u.role === "group_leader") return u.group_id === pkg.group_id || allowedGroupLeaderIds.has(u.id);
      return false;
    });

  const canAssignToSelf = currentUser?.role === "team_leader" || currentUser?.role === "group_leader";
  const advisors = canAssignToSelf && currentUser?.email && !assignableUsers.some(u => u.email === currentUser.email)
    ? [
        {
          id: "self",
          email: currentUser.email,
          name: currentUser.displayName || currentUser.full_name || currentUser.email,
          role: currentUser.role,
        },
        ...assignableUsers,
      ]
    : assignableUsers;

  const handleAssignSelected = () => {
    const user = advisors.find(u => u.email === assignTarget);
    if (!user) return;

    assignMutation.mutate({
      leadIds: Array.from(selected),
      userEmail: user.email,
      userName: user.name,
    });
  };

  // Wspólna funkcja do przeliczenia i zapisania assigned_count w paczce
  const recalcAssignedCount = async () => {
    // Pobierz świeży stan leadów (z opóźnieniem żeby baza zdążyła zapisać)
    await new Promise(r => setTimeout(r, 300));
    const fresh = await base44.entities.ContactLead.filter({ package_id: pkg.id });
    const total = fresh.length;
    const assigned = fresh.filter(l => l.assigned_user_email).length;
    await base44.entities.ContactPackage.update(pkg.id, {
      total_count: total,
      assigned_count: assigned,
    });
  };

  const assignMutation = useMutation({
    mutationFn: async ({ leadIds, userEmail, userName }) => {
      await base44.functions.invoke('assignContactLeads', {
        leadIds,
        userEmail,
        userName,
        packageId: pkg.id,
      });
    },
    onSuccess: async () => {
      setSelected(new Set());
      setAssignTarget("");
      setAssignDropdown(false);
      // Wymuś refetch zamiast tylko invalidate — gwarancja świeżych danych w UI
      await Promise.all([
        qc.refetchQueries({ queryKey: ["leads", pkg.id] }),
        qc.refetchQueries({ queryKey: ["contact-packages"] }),
      ]);
    },
  });

  const unassignMutation = useMutation({
    mutationFn: async (leadIds) => {
      for (const id of leadIds) {
        await base44.entities.ContactLead.update(id, {
          assigned_user_email: "",
          assigned_user_name: "",
          status: "unassigned",
        });
      }
      await recalcAssignedCount();
    },
    onSuccess: async () => {
      setSelected(new Set());
      // Wymuś refetch zamiast tylko invalidate — gwarancja świeżych danych w UI
      await Promise.all([
        qc.refetchQueries({ queryKey: ["leads", pkg.id] }),
        qc.refetchQueries({ queryKey: ["contact-packages"] }),
      ]);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ leadIds, archived }) => {
      for (const id of leadIds) {
        await base44.entities.ContactLead.update(id, archived ? {
          is_archived: true,
          archived_at: new Date().toISOString(),
          archived_by_email: currentUser.email,
          archived_by_name: currentUser.displayName || currentUser.full_name || currentUser.email,
        } : {
          is_archived: false,
          archived_at: "",
          archived_by_email: "",
          archived_by_name: "",
        });
      }
    },
    onSuccess: async () => {
      setSelected(new Set());
      await qc.refetchQueries({ queryKey: ["leads", pkg.id] });
    },
  });

  const updateLeadStatusMutation = useMutation({
    mutationFn: ({ id, status, notes }) =>
      base44.entities.ContactLead.update(id, {
        status,
        contact_notes: notes,
        contacted_at: new Date().toISOString(),
      }),
    onSuccess: async () => {
      await qc.refetchQueries({ queryKey: ["leads", pkg.id] });
    },
  });

  const filtered = useMemo(() => {
    return leads.filter(l => {
      const matchSearch =
        !search ||
        l.client_name?.toLowerCase().includes(search.toLowerCase()) ||
        l.client_phone?.includes(search) ||
        l.postal_code?.includes(search) ||
        l.assigned_user_name?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || l.status === statusFilter;
      const matchArchive = archiveTab === "archived" ? l.is_archived === true : l.is_archived !== true;
      return matchSearch && matchStatus && matchArchive;
    }).sort((a, b) => {
      if (sortMode === "postal_code") return (a.postal_code || "999999").localeCompare(b.postal_code || "999999", "pl");
      if (sortMode === "name") return (a.client_name || "").localeCompare(b.client_name || "", "pl");
      return 0;
    });
  }, [leads, search, statusFilter, archiveTab, sortMode]);

  const toggleSelect = (id) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(l => l.id)));
    }
  };

  const stats = useMemo(() => {
    const activeLeads = leads.filter(l => l.is_archived !== true);
    const archived = leads.filter(l => l.is_archived === true).length;
    const total = activeLeads.length;
    const assigned = activeLeads.filter(l => l.assigned_user_email).length;
    const unassigned = total - assigned;
    const interested = activeLeads.filter(l => l.status === "interested" || l.status === "meeting_scheduled").length;
    return { total, assigned, unassigned, interested, archived };
  }, [leads]);

  const getLeadDraft = (lead) => leadDrafts[lead.id] || {
    status: lead.status,
    notes: lead.contact_notes || "",
  };

  const updateLeadDraft = (lead, patch) => {
    setLeadDrafts((prev) => ({
      ...prev,
      [lead.id]: {
        status: prev[lead.id]?.status ?? lead.status,
        notes: prev[lead.id]?.notes ?? lead.contact_notes ?? "",
        ...patch,
      },
    }));
  };

  const handleLeadSave = (lead) => {
    const draft = getLeadDraft(lead);
    if (draft.status === "meeting_scheduled") {
      setMeetingLead({ ...lead, contact_notes: draft.notes });
      return;
    }

    updateLeadStatusMutation.mutate({
      id: lead.id,
      status: draft.status,
      notes: draft.notes,
    });
  };

  return (
    <div className="space-y-5">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{pkg.name}</h1>
          {pkg.description && <p className="text-sm text-gray-500">{pkg.description}</p>}
          {/* Edycja grupy — tylko admin */}
          {isAdmin && (
            <div className="flex items-center gap-2 mt-1">
              {editingGroup ? (
                <>
                  <select
                    value={newGroupId}
                    onChange={e => setNewGroupId(e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-green-200"
                  >
                    <option value="">— brak grupy —</option>
                    {allGroups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => updateGroupMutation.mutate(newGroupId)}
                    className="p-1 rounded hover:bg-green-50 text-green-600"
                    title="Zapisz"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { setEditingGroup(false); setNewGroupId(pkg.group_id || ""); }}
                    className="p-1 rounded hover:bg-gray-100 text-gray-400"
                    title="Anuluj"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditingGroup(true)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                  {pkg.group_name ? `Grupa: ${pkg.group_name}` : "Brak grupy — kliknij aby przypisać"}
                </button>
              )}
            </div>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => setShowAppendImport(true)}
          className="bg-green-600 hover:bg-green-700 text-white gap-2"
        >
          <Upload className="w-4 h-4" />
          Doimportuj
        </Button>
        <Badge variant="outline" className="text-xs">
          {new Date(pkg.created_date).toLocaleDateString("pl-PL")}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Łącznie", value: stats.total, color: "text-gray-900" },
          { label: "Przypisanych", value: stats.assigned, color: "text-blue-700" },
          { label: "Nieprzypisanych", value: stats.unassigned, color: "text-orange-600" },
          { label: "Zainteresowanych", value: stats.interested, color: "text-green-700" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-3 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button
          size="sm"
          variant={archiveTab === "active" ? "default" : "outline"}
          onClick={() => { setArchiveTab("active"); setSelected(new Set()); }}
          className={archiveTab === "active" ? "bg-green-600 hover:bg-green-700 text-white" : ""}
        >
          Aktywne ({stats.total})
        </Button>
        <Button
          size="sm"
          variant={archiveTab === "archived" ? "default" : "outline"}
          onClick={() => { setArchiveTab("archived"); setSelected(new Set()); }}
          className={archiveTab === "archived" ? "bg-gray-700 hover:bg-gray-800 text-white" : ""}
        >
          Zarchiwizowane ({stats.archived})
        </Button>
      </div>

      {/* Filters + bulk actions */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Szukaj kontaktu..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="all">Wszystkie statusy</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select
          value={sortMode}
          onChange={e => setSortMode(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="created">Kolejność importu</option>
          <option value="postal_code">Sortuj po kodzie pocztowym</option>
          <option value="name">Sortuj po nazwisku</option>
        </select>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-green-800">
            Wybrano: {selected.size} kontaktów
          </span>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={assignTarget}
                onChange={(e) => setAssignTarget(e.target.value)}
                className="h-8 rounded-md border border-green-200 bg-white px-3 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-200"
              >
                <option value="">Wybierz osobę…</option>
                {advisors.map(u => (
                  <option key={u.id} value={u.email}>
                    {u.name} — {u.email} ({u.role === "group_leader" ? "lider grupy" : u.role === "team_leader" ? "team leader" : "handlowiec"})
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                disabled={!assignTarget || assignMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white gap-1"
                onClick={handleAssignSelected}
              >
                <UserCheck className="w-4 h-4" />
                Przypisz
              </Button>
            </div>
            {archiveTab === "active" ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => unassignMutation.mutate(Array.from(selected))}
                  className="gap-1 text-orange-600 border-orange-200 hover:bg-orange-50"
                >
                  <RotateCcw className="w-4 h-4" />
                  Cofnij przypisanie
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => archiveMutation.mutate({ leadIds: Array.from(selected), archived: true })}
                  className="gap-1 text-gray-700 border-gray-300 hover:bg-gray-50"
                >
                  <Archive className="w-4 h-4" />
                  Ukryj / archiwizuj
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => archiveMutation.mutate({ leadIds: Array.from(selected), archived: false })}
                className="gap-1 text-green-700 border-green-200 hover:bg-green-50"
              >
                <ArchiveRestore className="w-4 h-4" />
                Przywróć
              </Button>
            )}
          </div>
        </div>
      )}

      {showAppendImport && (
        <PackageImportModal
          currentUser={currentUser}
          allGroups={allGroups}
          existingPackage={pkg}
          onClose={() => setShowAppendImport(false)}
          onSuccess={async () => {
            setShowAppendImport(false);
            await Promise.all([
              qc.refetchQueries({ queryKey: ["leads", pkg.id] }),
              qc.refetchQueries({ queryKey: ["contact-packages"] }),
            ]);
            if (onPackageUpdated) onPackageUpdated();
          }}
        />
      )}

      {/* Lead list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[32px_1fr_1fr_1fr_120px] gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <button onClick={selectAll} className="flex items-center justify-center">
              {selected.size === filtered.length && filtered.length > 0
                ? <CheckSquare className="w-4 h-4 text-green-600" />
                : <Square className="w-4 h-4 text-gray-400" />
              }
            </button>
            <span>Klient</span>
            <span>Telefon / Kod / Adres</span>
            <span>Przypisany do</span>
            <span>Status</span>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">Brak kontaktów spełniających filtry</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map(lead => {
                const advisorNote = lead.contact_notes;
                const importedNote = lead.notes;
                const isExpanded = expandedLeadId === lead.id;
                const hasMeetingDate = lead.status === "meeting_scheduled" && lead.scheduled_meeting_date;
                const meetingDateLabel = hasMeetingDate
                  ? new Date(lead.scheduled_meeting_date).toLocaleDateString("pl-PL", { day: "2-digit", month: "long", year: "numeric" })
                  : "";

                const canEditOwnAssignedLead =
                  archiveTab === "active" &&
                  ["group_leader", "team_leader", "admin"].includes(currentUser?.role);
                const leadDraft = getLeadDraft(lead);

                return (
                  <div key={lead.id} className={selected.has(lead.id) ? "bg-green-50/50" : ""}>
                    <div
                      className="grid grid-cols-[32px_1fr_1fr_1fr_120px] gap-3 px-4 py-3 items-center hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => setExpandedLeadId(isExpanded ? null : lead.id)}
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleSelect(lead.id); }}
                        className="flex items-center justify-center"
                      >
                        {selected.has(lead.id)
                          ? <CheckSquare className="w-4 h-4 text-green-600" />
                          : <Square className="w-4 h-4 text-gray-300" />
                        }
                      </button>
                      <span className="font-medium text-gray-900 text-sm truncate">{lead.client_name}</span>
                      <div className="text-xs text-gray-500 truncate">
                        {lead.client_phone && <div>{lead.client_phone}</div>}
                        {lead.postal_code && <div className="text-gray-600">Kod: {lead.postal_code}</div>}
                        {lead.client_address && <div className="text-gray-400">{lead.client_address}</div>}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm text-gray-600 truncate">
                          {lead.assigned_user_name || <span className="text-gray-300 italic">—</span>}
                        </div>
                        {advisorNote && (
                          <div className="mt-1 flex items-start gap-1 text-xs text-gray-500 bg-gray-50 rounded-md px-2 py-1" title={advisorNote}>
                            <MessageSquare className="w-3 h-3 mt-0.5 shrink-0 text-green-600" />
                            <span className="line-clamp-2">{advisorNote}</span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <span className={`block text-xs px-2 py-1 rounded-full font-medium text-center ${STATUS_COLORS[lead.status] || "bg-gray-100 text-gray-600"}`}>
                          {STATUS_LABELS[lead.status] || lead.status}
                        </span>
                        {hasMeetingDate && (
                          <div className="text-[11px] text-purple-700 text-center flex items-center justify-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {lead.scheduled_meeting_date}
                          </div>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 ml-8 grid gap-3 sm:grid-cols-2 text-sm">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="text-xs font-semibold text-gray-400 uppercase mb-1">Dane kontaktu</div>
                          <div className="font-medium text-gray-900">{lead.client_name}</div>
                          <div className="text-gray-600">{lead.client_phone || "Brak telefonu"}</div>
                          <div className="text-gray-500">{lead.client_address || "Brak adresu"}</div>
                        </div>
                        <div className="bg-green-50 rounded-lg p-3">
                          <div className="text-xs font-semibold text-green-700 uppercase mb-2">
                            {canEditOwnAssignedLead ? "Status i notatka" : "Notatka doradcy"}
                          </div>
                          {canEditOwnAssignedLead ? (
                            <div className="space-y-3">
                              <select
                                value={leadDraft.status}
                                onChange={(e) => updateLeadDraft(lead, { status: e.target.value })}
                                className="border border-green-200 rounded-lg px-3 py-2 text-sm bg-white w-full"
                              >
                                {Object.entries(STATUS_LABELS).filter(([value]) => value !== "unassigned" && value !== "assigned").map(([value, label]) => (
                                  <option key={value} value={value}>{label}</option>
                                ))}
                              </select>
                              {leadDraft.status === "meeting_scheduled" && (
                                <p className="text-xs text-purple-600">Kliknij „Zapisz zmiany”, aby wybrać termin spotkania.</p>
                              )}
                              <textarea
                                value={leadDraft.notes}
                                onChange={(e) => updateLeadDraft(lead, { notes: e.target.value })}
                                rows={3}
                                className="border border-green-200 rounded-lg px-3 py-2 text-sm w-full resize-none focus:outline-none focus:ring-2 focus:ring-green-200"
                                placeholder="Notatki z rozmowy..."
                              />
                              <Button
                                size="sm"
                                onClick={() => handleLeadSave(lead)}
                                disabled={updateLeadStatusMutation.isPending}
                                className="bg-green-600 hover:bg-green-700 text-white"
                              >
                                Zapisz zmiany
                              </Button>
                            </div>
                          ) : advisorNote ? (
                            <p className="text-gray-700 whitespace-pre-wrap">{advisorNote}</p>
                          ) : (
                            <p className="text-gray-400 italic">Brak notatki doradcy</p>
                          )}
                        </div>
                        {hasMeetingDate && (
                          <div className="sm:col-span-2 bg-purple-50 rounded-lg p-3">
                            <div className="text-xs font-semibold text-purple-700 uppercase mb-1">Umówione spotkanie</div>
                            <div className="flex flex-wrap items-center gap-4 text-purple-900">
                              <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{meetingDateLabel}</span>
                              {lead.scheduled_meeting_time && (
                                <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{lead.scheduled_meeting_time}</span>
                              )}
                            </div>
                          </div>
                        )}
                        {importedNote && (
                          <div className="sm:col-span-2 bg-yellow-50 rounded-lg p-3">
                            <div className="text-xs font-semibold text-yellow-700 uppercase mb-1">Notatka z importu</div>
                            <p className="text-gray-700 whitespace-pre-wrap">{importedNote}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {meetingLead && (
        <ScheduleMeetingModal
          lead={meetingLead}
          currentUser={currentUser}
          onClose={() => setMeetingLead(null)}
          onSuccess={async () => {
            setMeetingLead(null);
            await qc.refetchQueries({ queryKey: ["leads", pkg.id] });
          }}
        />
      )}
    </div>
  );
}