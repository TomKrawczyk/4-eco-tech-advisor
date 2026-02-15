import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Phone, MapPin, User, FileText, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/shared/PageHeader";

const statusConfig = {
  new: { label: "Nowe", color: "bg-blue-100 text-blue-800" },
  contacted: { label: "Skontaktowano", color: "bg-yellow-100 text-yellow-800" },
  scheduled: { label: "Zaplanowano", color: "bg-purple-100 text-purple-800" },
  completed: { label: "Zrealizowano", color: "bg-green-100 text-green-800" },
  rejected: { label: "Odrzucono", color: "bg-red-100 text-red-800" }
};

export default function Referrals() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [exporting, setExporting] = useState(false);
  const [formData, setFormData] = useState({
    client_name: "",
    client_address: "",
    client_phone: "",
    source_client: "",
    notes: ""
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      const user = await base44.auth.me();
      const allowedUsers = await base44.entities.AllowedUser.list();
      const userAccess = allowedUsers.find(allowed => 
        (allowed.data?.email || allowed.email) === user.email
      );
      if (userAccess) {
        user.role = userAccess.data?.role || userAccess.role;
        user.displayName = userAccess.data?.name || userAccess.name;
      }
      setCurrentUser(user);
    };
    fetchUser();
  }, []);

  const { data: allReferrals = [] } = useQuery({
    queryKey: ['referrals'],
    queryFn: () => base44.entities.Referral.list('-created_date'),
    enabled: !!currentUser
  });

  const { data: hierarchy = [] } = useQuery({
    queryKey: ['hierarchy'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getUsersInHierarchy', { 
        user_email: currentUser.email 
      });
      return response.data.users || [];
    },
    enabled: !!currentUser
  });

  const referrals = allReferrals.filter(ref => {
    const creatorEmail = ref.created_by;
    if (currentUser.role === 'admin') return true;
    return hierarchy.some(u => (u.data?.email || u.email) === creatorEmail);
  });

  const filteredReferrals = referrals.filter(ref => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      ref.client_name?.toLowerCase().includes(query) ||
      ref.client_phone?.includes(query) ||
      ref.client_address?.toLowerCase().includes(query) ||
      ref.source_client?.toLowerCase().includes(query)
    );
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Referral.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['referrals']);
      setShowAddDialog(false);
      setFormData({
        client_name: "",
        client_address: "",
        client_phone: "",
        source_client: "",
        notes: ""
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Referral.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['referrals']);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Referral.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['referrals']);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await base44.functions.invoke('exportReferralsToSheets');
      alert('Polecenia zostały wyeksportowane do Google Sheets');
    } catch (error) {
      alert('Błąd eksportu: ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  const stats = {
    total: filteredReferrals.length,
    new: filteredReferrals.filter(r => r.status === 'new').length,
    contacted: filteredReferrals.filter(r => r.status === 'contacted').length,
    completed: filteredReferrals.filter(r => r.status === 'completed').length
  };

  return (
    <div>
      <PageHeader 
        title="Lista Poleceń" 
        subtitle="Zarządzaj poleceniami od klientów"
      />

      {/* Akcje i wyszukiwanie */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1">
          <Input
            placeholder="Szukaj po nazwie, telefonie, adresie..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
          />
        </div>
        <div className="flex gap-2">
          {currentUser?.role === 'admin' && (
            <Button
              onClick={handleExport}
              disabled={exporting}
              variant="outline"
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              {exporting ? 'Eksportowanie...' : 'Eksportuj'}
            </Button>
          )}
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="bg-green-600 hover:bg-green-700 gap-2">
                <Plus className="w-4 h-4" />
                Dodaj polecenie
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Nowe polecenie</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Imię i nazwisko klienta *</Label>
                  <Input
                    value={formData.client_name}
                    onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Telefon *</Label>
                  <Input
                    value={formData.client_phone}
                    onChange={(e) => setFormData({ ...formData, client_phone: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Adres</Label>
                  <Input
                    value={formData.client_address}
                    onChange={(e) => setFormData({ ...formData, client_address: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Źródło polecenia</Label>
                  <Input
                    placeholder="Kto polecił?"
                    value={formData.source_client}
                    onChange={(e) => setFormData({ ...formData, source_client: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Uwagi</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                  />
                </div>
                <Button type="submit" className="w-full bg-green-600 hover:bg-green-700">
                  Dodaj polecenie
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statystyki */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="text-sm text-gray-600">Wszystkie</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Nowe</div>
          <div className="text-2xl font-bold text-blue-600">{stats.new}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Skontaktowano</div>
          <div className="text-2xl font-bold text-yellow-600">{stats.contacted}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Zrealizowano</div>
          <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
        </Card>
      </div>

      {/* Lista poleceń */}
      <div className="space-y-4">
        {filteredReferrals.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Brak poleceń</h3>
            <p className="text-gray-600">Dodaj pierwsze polecenie klikając przycisk powyżej</p>
          </Card>
        ) : (
          filteredReferrals.map((referral) => (
            <motion.div
              key={referral.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-gray-900">{referral.client_name}</h3>
                      <Badge className={statusConfig[referral.status].color}>
                        {statusConfig[referral.status].label}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                      {referral.client_phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          {referral.client_phone}
                        </div>
                      )}
                      {referral.client_address && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          {referral.client_address}
                        </div>
                      )}
                      {referral.source_client && (
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          Polecił: {referral.source_client}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={referral.status}
                      onValueChange={(status) => 
                        updateMutation.mutate({ id: referral.id, data: { status } })
                      }
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(statusConfig).map(([key, { label }]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(referral.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {referral.notes && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-sm text-gray-600">{referral.notes}</p>
                  </div>
                )}
                <div className="mt-3 text-xs text-gray-500">
                  Dodano: {new Date(referral.created_date).toLocaleString('pl-PL')} • 
                  Utworzył: {referral.created_by}
                </div>
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}