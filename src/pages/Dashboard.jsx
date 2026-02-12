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
  Activity
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Aktywni użytkownicy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">{allowedUsers.length}</div>
                <p className="text-xs text-gray-500 mt-1">
                  {allowedUsers.filter(u => u.role === "admin").length} administratorów
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Raporty wizyt
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">{visitReports.length}</div>
                <p className="text-xs text-gray-500 mt-1">
                  {visitReports.filter(r => r.status === "completed").length} ukończonych
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Aktywność
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  {visitReports.filter(r => {
                    const date = new Date(r.created_date);
                    const now = new Date();
                    const diffDays = (now - date) / (1000 * 60 * 60 * 24);
                    return diffDays <= 7;
                  }).length}
                </div>
                <p className="text-xs text-gray-500 mt-1">Raportów w tym tygodniu</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Szybkie akcje</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
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
                  <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer group border-gray-200 hover:border-gray-300 active:scale-[0.98]">
                    <CardContent className="p-4 md:p-6">
                      <div>
                        <h3 className="font-semibold text-sm md:text-base text-gray-900 mb-1">{action.title}</h3>
                        <p className="text-xs md:text-sm text-gray-500 line-clamp-2">{action.description}</p>
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Ostatnie raporty</h2>
            <Link to={createPageUrl("VisitReports")}>
              <Button variant="outline" size="sm">Zobacz wszystkie</Button>
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
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-gray-900">{report.client_name}</h3>
                          <p className="text-sm text-gray-500">{report.client_address}</p>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs px-2 py-1 rounded ${
                            report.status === "completed" 
                              ? "bg-green-100 text-green-700"
                              : report.status === "sent"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-700"
                          }`}>
                            {report.status === "completed" ? "Ukończony" : report.status === "sent" ? "Wysłany" : "Roboczy"}
                          </span>
                          <p className="text-xs text-gray-400 mt-1">
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