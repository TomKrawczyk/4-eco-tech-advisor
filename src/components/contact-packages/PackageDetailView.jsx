import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Users, Search, UserCheck, ChevronDown, CheckSquare, Square,
  Trash2, RotateCcw, MoreVertical, Pencil, Check, X
} from "lucide-react";

const STATUS_LABELS = {
  unassigned: "Nieprzypisany",
  assigned: "Przypisany",
  contacted: "Skontaktowany",
  interested: "Zainteresowany",
  not_interested: "Niezainteresowany",
  no_answer: "Brak odpowiedzi",
  meeting_scheduled: "Spotkanie umówione",
};

const STATUS_COLORS = {
  unassigned: "bg-gray-100 text-gray-600",
  assigned: "bg-blue-50 text-blue-700",
  contacted: "bg-yellow-50 text-yellow-700",
  interested: "bg-green-50 text-green-700",
  not_interested: "bg-red-50 text-red-700",
  no_answer: "bg-orange-50 text-orange-700",
  meeting_scheduled: "bg-purple-50 text-purple-700",
};

export default function PackageDetailView({ pkg, currentUser, onBack, onPackageUpdated }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState(new Set());
  const [assignTarget, setAssignTarget] = useState("");
  const [assignDropdown, setAssignDropdown] = useState(false);
  const [editingGroup, setEditingGroup] = useState(false);
  const [newGroupId, setNewGroupId] = useState(pkg.group_id || "");

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

  // Użytkownicy w grupie — handlowcy do przypisania
  const { data: allUsers = [] } = useQuery({
    queryKey: ["allowed-users-group", pkg.group_id],
    queryFn: () => base44.entities.AllowedUser.filter({ group_id: pkg.group_id }),
  });

  const { data: allGroups = [] } = useQuery({
    queryKey: ["groups-all"],
    queryFn: () => base44.entities.Group.list(),
    enabled: isAdmin,
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

  const advisors = allUsers.filter(u =>
    u.role === "advisor" || u.role === "team_leader"
  );

  const assignMutation = useMutation({
    mutationFn: async ({ leadIds, userEmail, userName }) => {
      const updates = leadIds.map(id =>
        base44.entities.ContactLead.update(id, {
          assigned_user_email: userEmail,
          assigned_user_name: userName,
          status: "assigned",
        })
      );
      await Promise.all(updates);

      // Aktualizuj licznik w paczce
      const newAssigned = leads.filter(
        l => l.assigned_user_email || leadIds.includes(l.id)
      ).length;
      await base44.entities.ContactPackage.update(pkg.id, {
        assigned_count: newAssigned,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads", pkg.id] });
      qc.invalidateQueries({ queryKey: ["contact-packages"] });
      setSelected(new Set());
      setAssignDropdown(false);
    },
  });

  const unassignMutation = useMutation({
    mutationFn: async (leadIds) => {
      await Promise.all(leadIds.map(id =>
        base44.entities.ContactLead.update(id, {
          assigned_user_email: null,
          assigned_user_name: null,
          status: "unassigned",
        })
      ));

      // Przelicz assigned_count — kontakty które zostały przypisane po tej operacji
      const stillAssigned = leads.filter(
        l => l.assigned_user_email && !leadIds.includes(l.id)
      ).length;
      await base44.entities.ContactPackage.update(pkg.id, {
        assigned_count: stillAssigned,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads", pkg.id] });
      qc.invalidateQueries({ queryKey: ["contact-packages"] });
      setSelected(new Set());
    },
  });

  const filtered = useMemo(() => {
    return leads.filter(l => {
      const matchSearch =
        !search ||
        l.client_name?.toLowerCase().includes(search.toLowerCase()) ||
        l.client_phone?.includes(search) ||
        l.assigned_user_name?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || l.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [leads, search, statusFilter]);

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
    const total = leads.length;
    const assigned = leads.filter(l => l.status !== "unassigned").length;
    const unassigned = leads.filter(l => l.status === "unassigned").length;
    const interested = leads.filter(l => l.status === "interested" || l.status === "meeting_scheduled").length;
    return { total, assigned, unassigned, interested };
  }, [leads]);

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
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-green-800">
            Wybrano: {selected.size} kontaktów
          </span>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {/* Assign dropdown */}
            <div className="relative">
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white gap-1"
                onClick={() => setAssignDropdown(d => !d)}
              >
                <UserCheck className="w-4 h-4" />
                Przypisz do…
                <ChevronDown className="w-3 h-3" />
              </Button>
              {assignDropdown && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-30 min-w-[200px] py-1 max-h-56 overflow-y-auto">
                  {advisors.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-gray-400">Brak handlowców w grupie</p>
                  ) : (
                    advisors.map(u => (
                      <button
                        key={u.id}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-green-50 transition-colors"
                        onClick={() => {
                          assignMutation.mutate({
                            leadIds: Array.from(selected),
                            userEmail: u.email,
                            userName: u.name,
                          });
                        }}
                      >
                        <div className="font-medium text-gray-900">{u.name}</div>
                        <div className="text-xs text-gray-400">{u.email}</div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => unassignMutation.mutate(Array.from(selected))}
              className="gap-1 text-orange-600 border-orange-200 hover:bg-orange-50"
            >
              <RotateCcw className="w-4 h-4" />
              Cofnij przypisanie
            </Button>
          </div>
        </div>
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
            <span>Telefon / Adres</span>
            <span>Przypisany do</span>
            <span>Status</span>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">Brak kontaktów spełniających filtry</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map(lead => (
                <div
                  key={lead.id}
                  className={`grid grid-cols-[32px_1fr_1fr_1fr_120px] gap-3 px-4 py-3 items-center hover:bg-gray-50 transition-colors ${selected.has(lead.id) ? "bg-green-50/50" : ""}`}
                >
                  <button onClick={() => toggleSelect(lead.id)} className="flex items-center justify-center">
                    {selected.has(lead.id)
                      ? <CheckSquare className="w-4 h-4 text-green-600" />
                      : <Square className="w-4 h-4 text-gray-300" />
                    }
                  </button>
                  <span className="font-medium text-gray-900 text-sm truncate">{lead.client_name}</span>
                  <div className="text-xs text-gray-500 truncate">
                    {lead.client_phone && <div>{lead.client_phone}</div>}
                    {lead.client_address && <div className="text-gray-400">{lead.client_address}</div>}
                  </div>
                  <span className="text-sm text-gray-600 truncate">
                    {lead.assigned_user_name || <span className="text-gray-300 italic">—</span>}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium text-center ${STATUS_COLORS[lead.status] || "bg-gray-100 text-gray-600"}`}>
                    {STATUS_LABELS[lead.status] || lead.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}