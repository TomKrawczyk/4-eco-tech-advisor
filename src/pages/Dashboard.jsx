import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Users, FileText, Calculator, TrendingUp, 
  CheckSquare, MessageSquare, BookOpen, Settings,
  Activity, ArrowRight, BarChart3, Zap
} from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { motion } from "framer-motion";

export default function Dashboard() {
  const [currentUser, setCurrentUser] = useState(null);
  
  // Log page view
  useEffect(() => {
    if (currentUser) {
      base44.functions.invoke('logActivity', {
        action_type: 'page_view',
        page_name: 'Dashboard'
      }).catch(err => console.error('Log error:', err));
    }
  }, [currentUser]);

  useEffect(() => {
    const fetchUserData = async () => {
      const user = await base44.auth.me();
      const allowedUsers = await base44.entities.AllowedUser.list();
      const userAccess = allowedUsers.find(allowed => 
        (allowed.data?.email || allowed.email) === user.email
      );
      
      if (userAccess) {
        user.displayName = userAccess.data?.name || userAccess.name;
        user.role = userAccess.data?.role || userAccess.role;
        user.allowedUserId = userAccess.id;
      }
      
      setCurrentUser(user);
    };
    
    fetchUserData();
  }, []);

  const { data: allVisitReports = [] } = useQuery({
    queryKey: ["visitReports"],
    queryFn: () => base44.entities.VisitReport.list("-created_date", 20),
    enabled: !!currentUser,
  });

  const { data: hierarchyData } = useQuery({
    queryKey: ["userHierarchy", currentUser?.email],
    queryFn: () => base44.functions.invoke('getUsersInHierarchy'),
    enabled: !!currentUser,
  });

  // Filtruj raporty według hierarchii
  const visitReports = React.useMemo(() => {
    if (!currentUser || !hierarchyData?.data) return [];
    
    const allowedEmails = hierarchyData.data.userEmails || [];
    return allVisitReports.filter(report => allowedEmails.includes(report.created_by));
  }, [allVisitReports, hierarchyData, currentUser]);

  const { data: allowedUsers = [] } = useQuery({
    queryKey: ["allowedUsers"],
    queryFn: () => base44.entities.AllowedUser.list(),
    enabled: currentUser?.role === "admin",
  });

  const isAdmin = currentUser?.role === "admin";

  const quickActions = [
    {
      title: "Checklista wizyt",
      description: "Przeprowadź techniczną kontrolę instalacji",
      icon: CheckSquare,
      path: "Checklist",
      color: "from-blue-500 to-blue-600",
    },
    {
      title: "Wywiad energetyczny",
      description: "Zbierz dane o zużyciu energii klienta",
      icon: MessageSquare,
      path: "Interview",
      color: "from-purple-500 to-purple-600",
    },
    {
      title: "Kalkulator PV",
      description: "Oblicz wielkość instalacji fotowoltaicznej",
      icon: Calculator,
      path: "PVCalculator",
      color: "from-green-500 to-green-600",
    },
    {
      title: "Autokonsumpcja",
      description: "Oblicz wskaźnik autokonsumpcji",
      icon: TrendingUp,
      path: "AutoconsumptionCalc",
      color: "from-orange-500 to-orange-600",
    },
    {
      title: "Edukacja",
      description: "Materiały o instalacjach PV",
      icon: BookOpen,
      path: "Education",
      color: "from-indigo-500 to-indigo-600",
    },
    {
      title: "Raporty wizyt",
      description: "Przeglądaj i eksportuj raporty",
      icon: FileText,
      path: "VisitReports",
      color: "from-teal-500 to-teal-600",
    },
  ];

  const recentReports = visitReports.slice(0, 3);

  return (
    <div>
      <PageHeader 
        title={`Witaj ${currentUser?.displayName || currentUser?.full_name || 'Użytkowniku'}!`}
        subtitle="Panel główny aplikacji 4-ECO Green Energy"
      />

      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-2">Aktywni użytkownicy</p>
                    <div className="text-3xl font-bold text-gray-900">{allowedUsers.length}</div>
                    <p className="text-xs text-gray-500 mt-2">
                      {allowedUsers.filter(u => u.role === "admin").length} administratorów
                    </p>
                  </div>
                  <Users className="w-10 h-10 text-green-500 opacity-20" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-2">Raporty wizyt</p>
                    <div className="text-3xl font-bold text-gray-900">{visitReports.length}</div>
                    <p className="text-xs text-gray-500 mt-2">
                      {visitReports.filter(r => r.status === "completed").length} ukończonych
                    </p>
                  </div>
                  <FileText className="w-10 h-10 text-blue-500 opacity-20" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-2">Aktywność</p>
                    <div className="text-3xl font-bold text-gray-900">
                      {visitReports.filter(r => {
                        const date = new Date(r.created_date);
                        const now = new Date();
                        const diffDays = (now - date) / (1000 * 60 * 60 * 24);
                        return diffDays <= 7;
                      }).length}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Raportów w tym tygodniu</p>
                  </div>
                  <BarChart3 className="w-10 h-10 text-purple-500 opacity-20" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-5">
          <Zap className="w-5 h-5 text-green-600" />
          <h2 className="text-lg font-bold text-gray-900">Szybki dostęp</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <motion.div
                key={action.path}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
              >
                <Link to={createPageUrl(action.path)}>
                  <Card className="group border-0 shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer active:scale-[0.98]">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-lg bg-gray-100 group-hover:bg-gray-200 transition-colors">
                          <Icon className="w-5 h-5 text-gray-700" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm text-gray-900 group-hover:text-green-700 transition-colors">{action.title}</h3>
                          <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{action.description}</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-green-600 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>

      {recentReports.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-green-600" />
              <h2 className="text-lg font-bold text-gray-900">Ostatnie raporty</h2>
            </div>
            <Link to={createPageUrl("VisitReports")}>
              <Button variant="ghost" size="sm" className="text-green-700 hover:bg-green-50">
                Wszystkie <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
          <div className="space-y-3">
            {recentReports.map((report, index) => (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * index }}
              >
                <Link to={createPageUrl(`VisitReports?reportId=${report.id}`)}>
                  <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 text-sm">{report.client_name}</h3>
                          <p className="text-xs text-gray-500 mt-1 truncate">{report.client_address}</p>
                        </div>
                        <div className="text-right ml-4 shrink-0">
                          <span className={`inline-block text-xs px-3 py-1 rounded-full font-medium ${
                            report.status === "completed" 
                              ? "bg-green-100 text-green-700"
                              : report.status === "sent"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-700"
                          }`}>
                            {report.status === "completed" ? "Ukończony" : report.status === "sent" ? "Wysłany" : "Roboczy"}
                          </span>
                          <p className="text-xs text-gray-400 mt-2">
                            {new Date(report.visit_date).toLocaleDateString("pl-PL")}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="mt-6">
          <Link to={createPageUrl("UserManagement")}>
            <Button variant="outline" className="w-full">
              Zarządzanie użytkownikami
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}