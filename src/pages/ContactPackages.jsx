import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import useCurrentUser from "@/components/shared/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ShieldAlert, Package, Plus, Users, Upload, ChevronRight, Search, X } from "lucide-react";
import PackageImportModal from "@/components/contact-packages/PackageImportModal";
import PackageDetailView from "@/components/contact-packages/PackageDetailView";
import ScheduleMeetingModal from "@/components/contact-packages/ScheduleMeetingModal";

export default function ContactPackages() {
  const { currentUser, accessChecked } = useCurrentUser();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);

  // Rola dostępu
  const isLeader = currentUser?.role === "group_leader" || currentUser?.role === "team_leader" || currentUser?.role === "admin";
  const isAdvisor = currentUser?.role === "advisor";
  const canManage = isLeader || currentUser?.role === "admin";

  const isAdmin = currentUser?.role === "admin";

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ["contact-packages", currentUser?.groupId, isAdmin],
    queryFn: async () => {
      if (isAdmin) return base44.entities.ContactPackage.list();
      if (currentUser.groupId) {
        return base44.entities.ContactPackage.filter({ group_id: currentUser.groupId });
      }
      // Lider bez groupId w AllowedUser — pobierz wszystkie i odfiltruj po grupach, w których jest liderem
      const allGroups = await base44.entities.Group.list();
      const myGroups = allGroups.filter(g => {
        const ids = g.data?.group_leader_ids || g.group_leader_ids || [];
        const legacyId = g.data?.group_leader_id || g.group_leader_id;
        return ids.includes(currentUser.allowedUserId) || ids.includes(currentUser.email) || legacyId === currentUser.allowedUserId || legacyId === currentUser.email;
      });
      if (myGroups.length === 0) return [];
      const allPkgs = await base44.entities.ContactPackage.list();
      const myGroupIds = new Set(myGroups.map(g => g.id));
      return allPkgs.filter(p => myGroupIds.has(p.group_id));
    },
    enabled: !!currentUser,
  });

  const { data: allGroups = [] } = useQuery({
    queryKey: ["groups-for-packages"],
    queryFn: () => base44.entities.Group.list(),
    enabled: !!currentUser && isAdmin,
  });

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
  if (selectedPackage) {
    return (
      <PackageDetailView
        pkg={selectedPackage}
        currentUser={currentUser}
        onBack={() => setSelectedPackage(null)}
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
              onClick={() => setSelectedPackage(pkg)}
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
    </div>
  );
}

function PackageCard({ pkg, onClick }) {
  const assigned = pkg.assigned_count || 0;
  const total = pkg.total_count || 0;
  const pct = total > 0 ? Math.round((assigned / total) * 100) : 0;

  return (
    <button
      onClick={onClick}
      className="text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-green-300 hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
          <Package className="w-5 h-5 text-green-600" />
        </div>
        <Badge variant={pkg.status === "archived" ? "secondary" : "outline"} className="text-xs">
          {pkg.status === "archived" ? "Archiwum" : "Aktywna"}
        </Badge>
      </div>
      <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-green-700 transition-colors">{pkg.name}</h3>
      {pkg.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{pkg.description}</p>}
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
  );
}

function AdvisorView({ leads, currentUser, qc }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const statusLabels = {
    unassigned: "Nieprzypisany",
    assigned: "Przypisany",
    contacted: "Skontaktowany",
    interested: "Zainteresowany",
    not_interested: "Niezainteresowany",
    no_answer: "Brak odpowiedzi",
    meeting_scheduled: "Spotkanie umówione",
  };

  const statusColors = {
    assigned: "bg-blue-50 text-blue-700",
    contacted: "bg-yellow-50 text-yellow-700",
    interested: "bg-green-50 text-green-700",
    not_interested: "bg-red-50 text-red-700",
    no_answer: "bg-gray-50 text-gray-600",
    meeting_scheduled: "bg-purple-50 text-purple-700",
  };

  const filtered = leads.filter(l => {
    const matchSearch = l.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      l.client_phone?.includes(search);
    const matchStatus = statusFilter === "all" || l.status === statusFilter;
    return matchSearch && matchStatus;
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LeadRow({ lead, statusLabels, statusColors, currentUser, onUpdateStatus, onMeetingScheduled }) {
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
            <Button size="sm" onClick={handleSave} className="bg-green-600 hover:bg-green-700 text-white">
              Zapisz
            </Button>
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