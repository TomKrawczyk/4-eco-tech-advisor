import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Bell, FileText, Users, X, Search, Trash2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { format } from "date-fns";

const typeIcons = {
  new_report: FileText,
  system_error: AlertCircle,
  user_activity: Users,
};
const typeColors = {
  new_report: "text-green-600 bg-green-50",
  system_error: "text-red-600 bg-red-50",
  user_activity: "text-blue-600 bg-blue-50",
};
const typeLabels = {
  new_report: "Nowy raport",
  system_error: "Błąd / Blokada",
  user_activity: "Aktywność",
};

export default function UserNotificationsTab({ allowedUsers }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterUser, setFilterUser] = useState("all");
  const [filterType, setFilterType] = useState("all");

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["allNotifications"],
    queryFn: () => base44.entities.Notification.list("-created_date", 200),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(["allNotifications"]);
      toast.success("Powiadomienie usunięte");
    },
  });

  const deleteAllForUserMutation = useMutation({
    mutationFn: async (email) => {
      const toDelete = notifications.filter(n => (n.data?.user_email || n.user_email) === email);
      await Promise.all(toDelete.map(n => base44.entities.Notification.delete(n.id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["allNotifications"]);
      toast.success("Usunięto wszystkie powiadomienia użytkownika");
    },
  });

  const filtered = notifications.filter(n => {
    const email = n.data?.user_email || n.user_email || "";
    const title = n.data?.title || n.title || "";
    const message = n.data?.message || n.message || "";
    const type = n.data?.type || n.type || "";

    const matchesSearch = !search ||
      email.toLowerCase().includes(search.toLowerCase()) ||
      title.toLowerCase().includes(search.toLowerCase()) ||
      message.toLowerCase().includes(search.toLowerCase());

    const matchesUser = filterUser === "all" || email === filterUser;
    const matchesType = filterType === "all" || type === filterType;

    return matchesSearch && matchesUser && matchesType;
  });

  const userEmails = [...new Set(notifications.map(n => n.data?.user_email || n.user_email).filter(Boolean))];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base md:text-lg font-semibold flex items-center gap-2">
          <Bell className="w-5 h-5 text-blue-500" />
          Powiadomienia użytkowników ({filtered.length})
        </h3>
        {filterUser !== "all" && (
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 border-red-200 hover:bg-red-50"
            onClick={() => deleteAllForUserMutation.mutate(filterUser)}
            disabled={deleteAllForUserMutation.isPending}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            Usuń wszystkie tego użytkownika
          </Button>
        )}
      </div>

      {/* Filtry */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Szukaj po emailu lub treści..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        <Select value={filterUser} onValueChange={setFilterUser}>
          <SelectTrigger className="w-full sm:w-56 h-10">
            <SelectValue placeholder="Użytkownik" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszyscy użytkownicy</SelectItem>
            {userEmails.map(email => {
              const ua = allowedUsers.find(u => (u.data?.email || u.email) === email);
              const name = ua?.data?.name || ua?.name || email;
              return <SelectItem key={email} value={email}>{name} ({email})</SelectItem>;
            })}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-44 h-10">
            <SelectValue placeholder="Typ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie typy</SelectItem>
            <SelectItem value="new_report">Nowy raport</SelectItem>
            <SelectItem value="system_error">Błąd / Blokada</SelectItem>
            <SelectItem value="user_activity">Aktywność</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="py-10 text-center">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-gray-400 text-sm">Brak powiadomień</div>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {filtered.map(n => {
            const email = n.data?.user_email || n.user_email || "";
            const title = n.data?.title || n.title || "";
            const message = n.data?.message || n.message || "";
            const type = n.data?.type || n.type || "system_error";
            const isRead = n.data?.is_read || n.is_read;
            const ua = allowedUsers.find(u => (u.data?.email || u.email) === email);
            const userName = ua?.data?.name || ua?.name || email;
            const Icon = typeIcons[type] || Bell;
            const colorClass = typeColors[type] || "text-gray-600 bg-gray-50";

            return (
              <div key={n.id} className={`flex items-start gap-3 p-3 rounded-lg border ${isRead ? "border-gray-200 bg-white" : "border-blue-200 bg-blue-50/40"}`}>
                <div className={`w-8 h-8 rounded-lg ${colorClass} flex items-center justify-center shrink-0`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-xs font-semibold text-gray-700">{userName}</span>
                    <span className="text-xs text-gray-400">{email}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${colorClass}`}>{typeLabels[type] || type}</span>
                    {!isRead && <span className="w-2 h-2 bg-blue-500 rounded-full inline-block" />}
                  </div>
                  <div className="text-sm font-medium text-gray-900">{title}</div>
                  <div className="text-xs text-gray-600 mt-0.5 line-clamp-2">{message}</div>
                  <div className="text-[10px] text-gray-400 mt-1">
                    {n.created_date ? format(new Date(n.created_date), "dd.MM.yyyy HH:mm") : "—"}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-7 w-7 text-gray-400 hover:text-red-500 hover:bg-red-50"
                  onClick={() => deleteMutation.mutate(n.id)}
                  disabled={deleteMutation.isPending}
                  title="Usuń powiadomienie"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}