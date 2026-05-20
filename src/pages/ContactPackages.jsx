import React, { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import useCurrentUser from "@/components/shared/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ShieldAlert, Package, Plus, Users, Upload, ChevronRight, Search, X, Pencil, Trash2 } from "lucide-react";
import PackageImportModal from "@/components/contact-packages/PackageImportModal";
import PackageDetailView from "@/components/contact-packages/PackageDetailView";
import ScheduleMeetingModal from "@/components/contact-packages/ScheduleMeetingModal";

export default function ContactPackages() {
  const { currentUser, accessChecked } = useCurrentUser();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState(null);
  const [editingPackage, setEditingPackage] = useState(null);
  const [deletingPackage, setDeletingPackage] = useState(null);

  const updatePackageMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ContactPackage.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contact-packages"] });
      setEditingPackage(null);
    },
  });

  const deletePackageMutation = useMutation({
    mutationFn: async (pkg) => {
      // Usuń leady paczki
      const leads = await base44.entities.ContactLead.filter({ package_id: pkg.id });
      await Promise.all(leads.map(l => base44.entities.ContactLead.delete(l.id)));
      await base44.entities.ContactPackage.delete(pkg.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contact-packages"] });
      setDeletingPackage(null);
    },
  });

  // Rola dostępu
  const isLeader = currentUser?.role === "group_leader" || currentUser?.role === "team_leader" || currentUser?.role === "admin";
  const isAdvisor = currentUser?.role === "advisor";
  const canManage = isLeader || currentUser?.role === "admin";

  const isAdmin = currentUser?.role === "admin";

  const { data: allGroups = [], isSuccess: groupsLoaded } = useQuery({
    queryKey: ["groups-for-packages"],
    queryFn: () => base44.entities.Group.list(),
    enabled: !!currentUser,
  });

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ["contact-packages", currentUser?.email, isAdmin],
    queryFn: async () => {
      if (isAdmin) return base44.entities.ContactPackage.list();

      // Zbierz wszystkie groupId gdzie user jest liderem (przez group_leader_ids lub group_id w AllowedUser)
      const myGroupIds = new Set();

      // Dodaj groupId z AllowedUser (bezpośrednie przypisanie)
      if (currentUser.groupId) myGroupIds.add(currentUser.groupId);

      // Dodaj wszystkie grupy, w których user jest wymieniony w group_leader_ids
      for (const g of allGroups) {
        const leaderIds = g.data?.group_leader_ids || g.group_leader_ids || [];
        const legacyId = g.data?.group_leader_id || g.group_leader_id;
        if (
          leaderIds.includes(currentUser.allowedUserId) ||
          leaderIds.includes(currentUser.email) ||
          legacyId === currentUser.allowedUserId ||
          legacyId === currentUser.email
        ) {
          myGroupIds.add(g.id);
        }
      }

      if (myGroupIds.size === 0) return [];

      const allPkgs = await base44.entities.ContactPackage.list();
      return allPkgs.filter(p => myGroupIds.has(p.group_id));
    },
    enabled: !!currentUser && (isAdmin || (groupsLoaded && allGroups.length >= 0)),
  });

  const packageIdsKey = useMemo(() => packages.map(p => p.id).sort().join("|"), [packages]);
  const packageIds = useMemo(() => new Set(packages.map(p => p.id)), [packages]);

  const { data: packageLeads = [] } = useQuery({
    queryKey: ["contact-package-leads", packageIdsKey],
    queryFn: async () => {
      const allLeads = await base44.entities.ContactLead.list();
      return allLeads.filter(l => packageIds.has(l.package_id));
    },
    enabled: !!currentUser && !isAdvisor && packages.length > 0,
  });

  const packageStats = useMemo(() => {
    const stats = {};
    packages.forEach(p => {
      stats[p.id] = { total: 0, assigned: 0 };
    });
    packageLeads.forEach(lead => {
      if (!stats[lead.package_id]) return;
      stats[lead.package_id].total += 1;
      if (lead.assigned_user_email) stats[lead.package_id].assigned += 1;
    });
    return stats;
  }, [packages, packageLeads]);

  const { data: myLeads = [] } = useQuery({
    queryKey: ["my-leads", currentUser?.email],
    queryFn: () => base44.entities.ContactLead.filter({ assigned_user_email: currentUser.email }),
    enabled: !!currentUser?.email && isAdvisor,
  });

  if (!accessChecked) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isLeader && !isAdvisor) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-gray-600">Brak dostępu do tej sekcji.</p>
        </div>
      </div>
    );
  }

  // Widok handlowca — tylko jego kontakty
  if (isAdvisor) {
    return <AdvisorView leads={myLeads} currentUser={currentUser} qc={qc} />;
  }

  // Jeśli wybraliśmy paczkę — widok szczegółowy
  const selectedPackage = selectedPackageId ? packages.find(p => p.id === selectedPackageId) : null;
  if (selectedPackageId) {
    if (!selectedPackage) {
      // Paczka jeszcze się ładuje lub nie istnieje
      return (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }
    return (
      <PackageDetailView
        pkg={selectedPackage}
        currentUser={currentUser}
        onBack={() => setSelectedPackageId(null)}
        onPackageUpdated={() => qc.invalidateQueries({ queryKey: ["contact-packages"] })}
      />
    );
  }

  const filtered = packages.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paczki kontaktów</h1>
          <p className="text-sm text-gray-500 mt-0.5">Importuj kontakty z Excela i przydzielaj handlowcom</p>
        </div>
        {canManage && (
          <Button
            onClick={() => setShowImport(true)}
            className="bg-green-600 hover:bg-green-700 text-white gap-2"
          >
            <Upload className="w-4 h-4" />
            Importuj paczkę
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Szukaj paczki..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Packages grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">Brak paczek kontaktów</p>
          <p className="text-sm mt-1">Zaimportuj pierwszą paczkę z pliku Excel</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(pkg => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              stats={packageStats[pkg.id]}
              isAdmin={isAdmin}
              onClick={() => setSelectedPackageId(pkg.id)}
              onEdit={isAdmin ? (e) => { e.stopPropagation(); setEditingPackage(pkg); } : null}
              onDelete={isAdmin ? (e) => { e.stopPropagation(); setDeletingPackage(pkg); } : null}
            />
          ))}
        </div>
      )}

      {showImport && (
        <PackageImportModal
          currentUser={currentUser}
          allGroups={allGroups}
          onClose={() => setShowImport(false)}
          onSuccess={() => {
            setShowImport(false);
            qc.invalidateQueries({ queryKey: ["contact-packages"] });
          }}
        />
      )}

      {/* Modal edycji paczki */}
      {editingPackage && (
        <EditPackageModal
          pkg={editingPackage}
          allGroups={allGroups}
          onClose={() => setEditingPackage(null)}
          onSave={(data) => updatePackageMutation.mutate({ id: editingPackage.id, data })}
          saving={updatePackageMutation.isPending}
        />
      )}

      {/* Modal potwierdzenia usunięcia */}
      {deletingPackage && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Usuń paczkę</h3>
            <p className="text-sm text-gray-600 mb-1">
              Czy na pewno chcesz usunąć paczkę <strong>{deletingPackage.name}</strong>?
            </p>
            <p className="text-xs text-red-500 mb-6">Zostaną usunięte wszystkie kontakty w tej paczce ({deletingPackage.total_count || 0} szt.).</p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setDeletingPackage(null)}>Anuluj</Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => deletePackageMutation.mutate(deletingPackage)}
                disabled={deletePackageMutation.isPending}
              >
                {deletePackageMutation.isPending ? "Usuwanie..." : "Usuń"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditPackageModal({ pkg, allGroups, onClose, onSave, saving }) {
  const [name, setName] = useState(pkg.name || "");
  const [description, setDescription] = useState(pkg.description || "");
  const [groupId, setGroupId] = useState(pkg.group_id || "");

  const handleSave = () => {
    const g = allGroups.find(g => g.id === groupId);
    onSave({
      name,
      description,
      group_id: groupId || "",
      group_name: g?.name || "",
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900">Edytuj paczkę</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Nazwa paczki *</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nazwa paczki" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Opis</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full resize-none focus:outline-none focus:ring-2 focus:ring-green-200"
              placeholder="Opcjonalny opis..."
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Grupa</label>
            <select
              value={groupId}
              onChange={e => setGroupId(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full bg-white focus:outline-none focus:ring-2 focus:ring-green-200"
            >
              <option value="">— brak grupy —</option>
              {allGroups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-3 justify-end mt-6">
          <Button variant="outline" onClick={onClose}>Anuluj</Button>
          <Button
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={handleSave}
            disabled={!name || saving}
          >
            {saving ? "Zapisywanie..." : "Zapisz"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PackageCard({ pkg, stats, onClick, isAdmin, onEdit, onDelete }) {
  const assigned = stats?.assigned ?? pkg.assigned_count ?? 0;
  const total = stats?.total ?? pkg.total_count ?? 0;
  const pct = total > 0 ? Math.round((assigned / total) * 100) : 0;

  return (
    <div className="relative bg-white border border-gray-200 rounded-xl p-4 hover:border-green-300 hover:shadow-md transition-all group">
      {/* Admin actions */}
      {isAdmin && (
        <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg bg-white border border-gray-200 hover:bg-blue-50 hover:border-blue-300 text-gray-400 hover:text-blue-600 transition-colors shadow-sm"
            title="Edytuj"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg bg-white border border-gray-200 hover:bg-red-50 hover:border-red-300 text-gray-400 hover:text-red-600 transition-colors shadow-sm"
            title="Usuń"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      <button onClick={onClick} className="text-left w-full">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
            <Package className="w-5 h-5 text-green-600" />
          </div>
          <Badge variant={pkg.status === "archived" ? "secondary" : "outline"} className="text-xs">
            {pkg.status === "archived" ? "Archiwum" : "Aktywna"}
          </Badge>
        </div>
        <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-green-700 transition-colors pr-12">{pkg.name}</h3>
        {pkg.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{pkg.description}</p>}
        {pkg.group_name && <p className="text-xs text-green-600 mb-2 font-medium">{pkg.group_name}</p>}
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{total} kontaktów</span>
          <span>{pct}% przypisanych</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div
            className="bg-green-500 h-1.5 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-gray-400">
            {new Date(pkg.created_date).toLocaleDateString("pl-PL")}
          </span>
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-green-600 transition-colors" />
        </div>
      </button>
    </div>
  );
}

function AdvisorView({ leads, currentUser, qc }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [archiveTab, setArchiveTab] = useState("active");

  const statusLabels = {
    unassigned: "Nieprzypisany",
    assigned: "Przypisany",
    contacted: "Skontaktowany",
    interested: "Zainteresowany",
    not_interested: "Niezainteresowany",
    no_answer: "Brak odpowiedzi",
    meeting_scheduled: "Spotkanie umówione",
    contract_signed: "Umowa podpisana",
  };

  const statusColors = {
    assigned: "bg-blue-50 text-blue-700",
    contacted: "bg-yellow-50 text-yellow-700",
    interested: "bg-green-50 text-green-700",
    not_interested: "bg-red-50 text-red-700",
    no_answer: "bg-gray-50 text-gray-600",
    meeting_scheduled: "bg-purple-50 text-purple-700",
    contract_signed: "bg-emerald-100 text-emerald-800",
  };

  const filtered = leads.filter(l => {
    const matchSearch = l.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      l.client_phone?.includes(search);
    const matchStatus = statusFilter === "all" || l.status === statusFilter;
    const matchArchive = archiveTab === "archived" ? l.is_archived === true : l.is_archived !== true;
    return matchSearch && matchStatus && matchArchive;
  });

  const archiveCounts = useMemo(() => ({
    active: leads.filter(l => l.is_archived !== true).length,
    archived: leads.filter(l => l.is_archived === true).length,
  }), [leads]);

  const archiveLead = useMutation({
    mutationFn: ({ lead, archived }) => base44.entities.ContactLead.update(lead.id, archived ? {
      is_archived: true,
      archived_at: new Date().toISOString(),
      archived_by_email: currentUser.email,
      archived_by_name: currentUser.displayName || currentUser.full_name || currentUser.email,
    } : {
      is_archived: false,
      archived_at: "",
      archived_by_email: "",
      archived_by_name: "",
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-leads"] }),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status, notes }) =>
      base44.entities.ContactLead.update(id, {
        status,
        contact_notes: notes,
        contacted_at: new Date().toISOString(),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-leads"] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Moje kontakty</h1>
        <p className="text-sm text-gray-500 mt-0.5">Przydzielone do Ciebie kontakty do obdzwonienia</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button
          size="sm"
          variant={archiveTab === "active" ? "default" : "outline"}
          onClick={() => setArchiveTab("active")}
          className={archiveTab === "active" ? "bg-green-600 hover:bg-green-700 text-white" : ""}
        >
          Aktywne ({archiveCounts.active})
        </Button>
        <Button
          size="sm"
          variant={archiveTab === "archived" ? "default" : "outline"}
          onClick={() => setArchiveTab("archived")}
          className={archiveTab === "archived" ? "bg-gray-700 hover:bg-gray-800 text-white" : ""}
        >
          Zarchiwizowane ({archiveCounts.archived})
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Szukaj..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="all">Wszystkie statusy</option>
          {Object.entries(statusLabels).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p>Brak przydzielonych kontaktów</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(lead => (
            <LeadRow
              key={lead.id}
              lead={lead}
              statusLabels={statusLabels}
              statusColors={statusColors}
              currentUser={currentUser}
              onUpdateStatus={(status, notes) => updateStatus.mutate({ id: lead.id, status, notes })}
              onMeetingScheduled={() => qc.invalidateQueries({ queryKey: ["my-leads"] })}
              onArchive={(archived) => archiveLead.mutate({ lead, archived })}
              archiveTab={archiveTab}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LeadRow({ lead, statusLabels, statusColors, currentUser, onUpdateStatus, onMeetingScheduled, onArchive, archiveTab }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(lead.contact_notes || "");
  const [status, setStatus] = useState(lead.status);
  const [showMeetingModal, setShowMeetingModal] = useState(false);

  const handleStatusChange = (newStatus) => {
    setStatus(newStatus);
    if (newStatus === "meeting_scheduled") {
      setShowMeetingModal(true);
    }
  };

  const handleSave = () => {
    if (status === "meeting_scheduled") {
      setShowMeetingModal(true);
    } else {
      onUpdateStatus(status, notes);
    }
  };

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <button
          className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
          onClick={() => setExpanded(e => !e)}
        >
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900">{lead.client_name}</div>
            <div className="text-sm text-gray-500">{lead.client_phone} {lead.client_address && `· ${lead.client_address}`}</div>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${statusColors[lead.status] || "bg-gray-50 text-gray-600"}`}>
            {statusLabels[lead.status] || lead.status}
          </span>
          <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${expanded ? "rotate-90" : ""}`} />
        </button>
        {expanded && (
          <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
            {lead.notes && <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-2">{lead.notes}</p>}
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Status kontaktu</label>
              <select
                value={status}
                onChange={e => handleStatusChange(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white w-full"
              >
                {Object.entries(statusLabels).filter(([v]) => v !== "unassigned" && v !== "assigned").map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              {status === "meeting_scheduled" && (
                <p className="text-xs text-purple-600 mt-1">Kliknij "Zapisz" aby wybrać datę spotkania i dodać do kalendarza.</p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Notatki</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full resize-none focus:outline-none focus:ring-2 focus:ring-green-200"
                placeholder="Notatki z rozmowy..."
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {archiveTab === "active" && (
                <Button size="sm" onClick={handleSave} className="bg-green-600 hover:bg-green-700 text-white">
                  Zapisz
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => onArchive(archiveTab === "active")}
                className={archiveTab === "active" ? "text-gray-700" : "text-green-700 border-green-200 hover:bg-green-50"}
              >
                {archiveTab === "active" ? "Ukryj / archiwizuj" : "Przywróć kontakt"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {showMeetingModal && (
        <ScheduleMeetingModal
          lead={{ ...lead, contact_notes: notes }}
          currentUser={currentUser}
          onClose={() => { setShowMeetingModal(false); setStatus(lead.status); }}
          onSuccess={() => {
            setShowMeetingModal(false);
            onMeetingScheduled();
            setExpanded(false);
          }}
        />
      )}
    </>
  );
}