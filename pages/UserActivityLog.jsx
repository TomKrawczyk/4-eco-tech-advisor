import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import PageHeader from "../components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar, Eye, FileEdit, Trash2, Mail, Download, Calculator, FileText } from "lucide-react";

const actionIcons = {
  page_view: Eye,
  report_create: FileEdit,
  report_update: FileEdit,
  report_delete: Trash2,
  report_export: Download,
  report_send_email: Mail,
  checklist_save: FileText,
  interview_save: FileText,
  calculator_use: Calculator
};

const actionLabels = {
  page_view: "Wyświetlenie strony",
  report_create: "Utworzenie raportu",
  report_update: "Edycja raportu",
  report_delete: "Usunięcie raportu",
  report_export: "Eksport raportu",
  report_send_email: "Wysłanie emaila",
  checklist_save: "Zapis checklisty",
  interview_save: "Zapis wywiadu",
  calculator_use: "Użycie kalkulatora"
};

const actionColors = {
  page_view: "bg-blue-100 text-blue-800",
  report_create: "bg-green-100 text-green-800",
  report_update: "bg-yellow-100 text-yellow-800",
  report_delete: "bg-red-100 text-red-800",
  report_export: "bg-purple-100 text-purple-800",
  report_send_email: "bg-indigo-100 text-indigo-800",
  checklist_save: "bg-cyan-100 text-cyan-800",
  interview_save: "bg-teal-100 text-teal-800",
  calculator_use: "bg-orange-100 text-orange-800"
};

export default function UserActivityLog() {
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedUser, setSelectedUser] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const user = await base44.auth.me();
        const allowedUsers = await base44.entities.AllowedUser.list();
        const userAccess = allowedUsers.find(allowed => 
          (allowed.data?.email || allowed.email) === user.email
        );
        
        if (userAccess && (userAccess.data?.role || userAccess.role) === "admin") {
          setCurrentUser(user);
        }
      } catch (error) {
        console.error('Błąd sprawdzania dostępu:', error);
      }
    };
    checkAccess();
  }, []);

  const { data: users = [] } = useQuery({
    queryKey: ['allowedUsers'],
    queryFn: () => base44.entities.AllowedUser.list(),
    enabled: !!currentUser
  });

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['activityLogs', selectedUser],
    queryFn: async () => {
      if (!selectedUser) return [];
      const logs = await base44.entities.ActivityLog.filter({ user_email: selectedUser }, '-created_date');
      return logs;
    },
    enabled: !!selectedUser,
    refetchInterval: 30000 // Odświeżaj co 30 sekund
  });

  const { data: userReports = [] } = useQuery({
    queryKey: ['userReports', selectedUser],
    queryFn: async () => {
      if (!selectedUser) return [];
      const reports = await base44.entities.VisitReport.filter({ created_by: selectedUser }, '-created_date', 10);
      return reports;
    },
    enabled: !!selectedUser
  });

  const selectedUserData = users.find(u => (u.data?.email || u.email) === selectedUser);
  const lastActivity = selectedUserData?.data?.last_activity || selectedUserData?.last_activity;
  const isOnline = lastActivity && (new Date() - new Date(lastActivity)) < 5 * 60 * 1000; // 5 minut
  const latestActivity = activities[0];
  const latestReport = userReports[0];

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-gray-600">Brak dostępu - tylko dla administratorów</p>
        </div>
      </div>
    );
  }

  const filteredActivities = activities.filter(activity => {
    if (actionFilter !== "all" && activity.action_type !== actionFilter) return false;
    if (searchQuery && !activity.page_name?.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !activity.details?.client_name?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (dateFrom && new Date(activity.created_date) < new Date(dateFrom)) return false;
    if (dateTo && new Date(activity.created_date) > new Date(dateTo + "T23:59:59")) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Historia aktywności użytkowników" 
        subtitle="Szczegółowe logowanie akcji w aplikacji"
      />

      {/* Filtry */}
      <Card className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label className="text-xs text-gray-600 mb-2">Użytkownik *</Label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger>
                <SelectValue placeholder="Wybierz użytkownika" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.data?.email || user.email}>
                    {user.data?.name || user.name} ({user.data?.email || user.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-gray-600 mb-2">Typ akcji</Label>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie akcje</SelectItem>
                <SelectItem value="page_view">Wyświetlenia stron</SelectItem>
                <SelectItem value="report_create">Utworzenie raportu</SelectItem>
                <SelectItem value="report_update">Edycja raportu</SelectItem>
                <SelectItem value="report_delete">Usunięcie raportu</SelectItem>
                <SelectItem value="report_export">Eksport</SelectItem>
                <SelectItem value="report_send_email">Email</SelectItem>
                <SelectItem value="checklist_save">Checklista</SelectItem>
                <SelectItem value="interview_save">Wywiad</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-gray-600 mb-2">Data od</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>

          <div>
            <Label className="text-xs text-gray-600 mb-2">Data do</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>

        <div>
          <Label className="text-xs text-gray-600 mb-2">Wyszukaj</Label>
          <Input
            placeholder="Nazwa strony, klient..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </Card>

      {/* Status użytkownika */}
      {selectedUser && (
        <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <div className="flex items-start gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-green-600 flex items-center justify-center text-white text-2xl font-bold">
                {selectedUserData?.data?.name?.charAt(0) || selectedUserData?.name?.charAt(0) || '?'}
              </div>
              <div className={`absolute bottom-0 right-0 w-5 h-5 rounded-full border-3 border-white ${
                isOnline ? 'bg-green-500' : 'bg-gray-400'
              }`}></div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-xl font-bold text-gray-900">
                  {selectedUserData?.data?.name || selectedUserData?.name}
                </h3>
                <Badge className={isOnline ? 'bg-green-600' : 'bg-gray-400'}>
                  {isOnline ? '🟢 Online' : '⚫ Offline'}
                </Badge>
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <div>📧 {selectedUser}</div>
                <div>🕐 Ostatnie logowanie: {lastActivity ? new Date(lastActivity).toLocaleString('pl-PL') : 'Brak danych'}</div>
                {latestActivity && (
                  <div className="mt-2 pt-2 border-t border-green-200">
                    <span className="font-semibold text-green-700">Aktualnie: </span>
                    <span className="text-gray-700">
                      {latestActivity.page_name || actionLabels[latestActivity.action_type]}
                    </span>
                    <span className="text-gray-500 text-xs ml-2">
                      ({new Date(latestActivity.created_date).toLocaleTimeString('pl-PL')})
                    </span>
                  </div>
                )}
                {latestReport && (
                  <div className="mt-1">
                    <span className="font-semibold text-green-700">Ostatni raport: </span>
                    <span className="text-gray-700">{latestReport.client_name || 'Bez nazwy'}</span>
                    <span className="text-gray-500 text-xs ml-2">
                      ({new Date(latestReport.created_date).toLocaleDateString('pl-PL')})
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Statystyki */}
      {selectedUser && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-sm text-gray-600">Wszystkie akcje</div>
            <div className="text-2xl font-bold text-gray-900">{activities.length}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Utworzone raporty</div>
            <div className="text-2xl font-bold text-green-600">
              {userReports.length}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Edycje raportów</div>
            <div className="text-2xl font-bold text-blue-600">
              {activities.filter(a => a.action_type === "report_update").length}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Wyświetlenia stron</div>
            <div className="text-2xl font-bold text-purple-600">
              {activities.filter(a => a.action_type === "page_view").length}
            </div>
          </Card>
        </div>
      )}

      {/* Lista aktywności */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">
          Logi aktywności
          {filteredActivities.length > 0 && (
            <span className="text-sm font-normal text-gray-500 ml-2">
              ({filteredActivities.length})
            </span>
          )}
        </h3>

        {!selectedUser ? (
          <div className="text-center py-12 text-gray-500">
            Wybierz użytkownika aby zobaczyć historię aktywności
          </div>
        ) : isLoading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Brak aktywności dla wybranych filtrów
          </div>
        ) : (
          <div className="space-y-3">
            {filteredActivities.map((activity) => {
              const Icon = actionIcons[activity.action_type] || Eye;
              return (
                <div
                  key={activity.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-green-300 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={actionColors[activity.action_type]}>
                          {actionLabels[activity.action_type]}
                        </Badge>
                        {activity.page_name && (
                          <span className="text-sm text-gray-600">• {activity.page_name}</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-1 mb-2">
                        <Calendar className="w-3 h-3" />
                        {new Date(activity.created_date).toLocaleString('pl-PL')}
                      </div>
                      {activity.details && Object.keys(activity.details).length > 0 && (
                        <div className="bg-gray-50 rounded p-2 text-xs">
                          <div className="font-semibold text-gray-700 mb-1">Szczegóły:</div>
                          {activity.details.client_name && (
                            <div>Klient: {activity.details.client_name}</div>
                          )}
                          {activity.details.report_status && (
                            <div>Status: {activity.details.report_status}</div>
                          )}
                          {activity.details.fields_filled && (
                            <div>Wypełnione pola: {activity.details.fields_filled}</div>
                          )}
                          {activity.details.calculation_type && (
                            <div>Typ kalkulacji: {activity.details.calculation_type}</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}