import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Trash2, Plus, Shield, Search, Filter, Mail } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { toast } from "react-hot-toast";

export default function UserManagement() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("user");
  const [notes, setNotes] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [userToDelete, setUserToDelete] = useState(null);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);

  const queryClient = useQueryClient();

  const { data: allowedUsers = [], isLoading } = useQuery({
    queryKey: ["allowedUsers"],
    queryFn: () => base44.entities.AllowedUser.list(),
  });

  React.useEffect(() => {
    base44.auth.me().then(setCurrentUser);
  }, []);

  const addUserMutation = useMutation({
    mutationFn: async (data) => {
      console.log("Dodawanie użytkownika:", data);
      
      // Najpierw dodajemy do AllowedUser
      const allowedUser = await base44.entities.AllowedUser.create(data);
      
      // Następnie zapraszamy przez Base44 (jeśli się nie uda, AllowedUser już istnieje)
      try {
        await base44.users.inviteUser(data.email, data.role);
      } catch (inviteError) {
        console.warn("Zaproszenie nie powiodło się (użytkownik może już istnieć):", inviteError);
        // Nie przerywamy - użytkownik został dodany do AllowedUser
      }
      
      return allowedUser;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["allowedUsers"]);
      setEmail("");
      setName("");
      setRole("user");
      setNotes("");
      toast.success("Użytkownik dodany pomyślnie");
    },
    onError: (error) => {
      console.error("Błąd dodawania użytkownika:", error);
      toast.error(`Błąd: ${error.message}`);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id) => base44.entities.AllowedUser.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(["allowedUsers"]);
      setUserToDelete(null);
      toast.success("Użytkownik usunięty");
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids) => {
      await Promise.all(ids.map(id => base44.entities.AllowedUser.delete(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["allowedUsers"]);
      setSelectedUsers([]);
      setShowBulkDeleteDialog(false);
      toast.success("Użytkownicy usunięci");
    },
  });

  const resendInviteMutation = useMutation({
    mutationFn: async (user) => {
      await base44.users.inviteUser(user.email, user.role);
    },
    onSuccess: () => {
      toast.success("Zaproszenie wysłane ponownie");
    },
    onError: (error) => {
      toast.error(`Błąd: ${error.message}`);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Submit clicked", { email, name, role, notes });
    if (!email || !name) {
      toast.error("Email i imię są wymagane");
      return;
    }
    addUserMutation.mutate({ email, name, role, notes });
  };

  const filteredUsers = useMemo(() => {
    return allowedUsers.filter(user => {
      const email = user.data?.email || user.email;
      const role = user.data?.role || user.role;
      const matchesSearch = email?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === "all" || role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [allowedUsers, searchTerm, roleFilter]);

  const toggleUserSelection = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(u => u.id));
    }
  };

  if (currentUser?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Brak dostępu</h2>
          <p className="text-gray-600">Tylko administratorzy mogą zarządzać użytkownikami</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader 
        title="Zarządzanie użytkownikami" 
        subtitle="Dodaj emaile użytkowników z dostępem do aplikacji"
      />

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6 mb-6">
        <h3 className="text-base md:text-lg font-semibold mb-4">Dodaj użytkownika</h3>
        <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
          <div>
            <Label className="text-sm">Email *</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@przykład.pl"
              className="h-11"
            />
          </div>
          <div>
            <Label className="text-sm">Imię *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jan"
              className="h-11"
            />
          </div>
          <div>
            <Label className="text-sm">Rola</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Użytkownik</SelectItem>
                <SelectItem value="admin">Administrator</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm">Notatki (opcjonalnie)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Dodatkowe informacje"
              className="h-11"
            />
          </div>
          <Button type="submit" disabled={addUserMutation.isPending} className="w-full sm:w-auto h-11">
            {addUserMutation.isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                Dodawanie...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Dodaj użytkownika
              </>
            )}
          </Button>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <h3 className="text-base md:text-lg font-semibold">Lista użytkowników ({filteredUsers.length})</h3>
          {selectedUsers.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowBulkDeleteDialog(true)}
              className="w-full sm:w-auto"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Usuń ({selectedUsers.length})
            </Button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 md:gap-3 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Szukaj po emailu..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-11"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full sm:w-40 h-11">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie role</SelectItem>
              <SelectItem value="user">Użytkownik</SelectItem>
              <SelectItem value="admin">Administrator</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-gray-500">Ładowanie...</p>
        ) : filteredUsers.length === 0 ? (
          <p className="text-gray-500">Brak użytkowników</p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-3 border-b border-gray-200">
              <Checkbox
                checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-sm text-gray-600 font-medium">Zaznacz wszystkie</span>
            </div>
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-start sm:items-center gap-2 sm:gap-3 p-3 rounded-lg border border-gray-200 hover:border-gray-300"
              >
                <Checkbox
                  checked={selectedUsers.includes(user.id)}
                  onCheckedChange={() => toggleUserSelection(user.id)}
                  className="mt-1 sm:mt-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    <span className="font-semibold text-sm">{user.data?.name || user.name}</span>
                    <span className="text-xs text-gray-500 break-all">({user.data?.email || user.email})</span>
                    <span className={`text-xs px-2 py-0.5 rounded w-fit ${
                      (user.data?.role || user.role) === "admin" 
                        ? "bg-purple-100 text-purple-700" 
                        : "bg-gray-100 text-gray-700"
                    }`}>
                      {user.data?.role || user.role}
                    </span>
                  </div>
                  {(user.data?.notes || user.notes) && (
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">{user.data?.notes || user.notes}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => resendInviteMutation.mutate(user)}
                    className="shrink-0"
                    title="Wyślij zaproszenie ponownie"
                  >
                    <Mail className="w-4 h-4 text-blue-500" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setUserToDelete(user)}
                    className="shrink-0"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Czy na pewno usunąć użytkownika?</AlertDialogTitle>
            <AlertDialogDescription>
              Użytkownik <strong>{userToDelete?.email}</strong> straci dostęp do aplikacji. Ta operacja jest nieodwracalna.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteUserMutation.mutate(userToDelete.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć {selectedUsers.length} użytkowników?</AlertDialogTitle>
            <AlertDialogDescription>
              Wybrani użytkownicy stracą dostęp do aplikacji. Ta operacja jest nieodwracalna.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteMutation.mutate(selectedUsers)}
              className="bg-red-600 hover:bg-red-700"
            >
              Usuń wszystkich
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}