import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Shield } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { toast } from "react-hot-toast";

export default function UserManagement() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("user");
  const [notes, setNotes] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  const queryClient = useQueryClient();

  const { data: allowedUsers = [], isLoading } = useQuery({
    queryKey: ["allowedUsers"],
    queryFn: () => base44.entities.AllowedUser.list(),
  });

  React.useEffect(() => {
    base44.auth.me().then(setCurrentUser);
  }, []);

  const addUserMutation = useMutation({
    mutationFn: (data) => base44.entities.AllowedUser.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["allowedUsers"]);
      setEmail("");
      setNotes("");
      toast.success("Użytkownik dodany");
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id) => base44.entities.AllowedUser.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(["allowedUsers"]);
      toast.success("Użytkownik usunięty");
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email) return;
    addUserMutation.mutate({ email, role, notes });
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

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Dodaj użytkownika</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@przykład.pl"
            />
          </div>
          <div>
            <Label>Rola</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Użytkownik</SelectItem>
                <SelectItem value="admin">Administrator</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Notatki (opcjonalnie)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Dodatkowe informacje"
            />
          </div>
          <Button type="submit" disabled={addUserMutation.isPending}>
            <Plus className="w-4 h-4 mr-2" />
            Dodaj użytkownika
          </Button>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Lista użytkowników ({allowedUsers.length})</h3>
        {isLoading ? (
          <p className="text-gray-500">Ładowanie...</p>
        ) : allowedUsers.length === 0 ? (
          <p className="text-gray-500">Brak użytkowników</p>
        ) : (
          <div className="space-y-2">
            {allowedUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-gray-300"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{user.email}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      user.role === "admin" 
                        ? "bg-purple-100 text-purple-700" 
                        : "bg-gray-100 text-gray-700"
                    }`}>
                      {user.role}
                    </span>
                  </div>
                  {user.notes && (
                    <p className="text-sm text-gray-500 mt-1">{user.notes}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteUserMutation.mutate(user.id)}
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}