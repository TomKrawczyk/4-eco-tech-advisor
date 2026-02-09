import React, { useState } from "react";
import { FileText, Search, Eye, Trash2, Clock, CheckCircle2, Send, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PageHeader from "../components/shared/PageHeader";
import ReportDetail from "../components/reports/ReportDetail";

const statusConfig = {
  draft: { label: "Szkic", icon: Clock, color: "bg-gray-100 text-gray-700 border-gray-300" },
  completed: { label: "Ukończony", icon: CheckCircle2, color: "bg-green-100 text-green-700 border-green-300" },
  sent: { label: "Wysłany", icon: Send, color: "bg-blue-100 text-blue-700 border-blue-300" },
};

export default function VisitReports() {
  const [search, setSearch] = useState("");
  const [selectedReport, setSelectedReport] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    const fetchUserData = async () => {
      const user = await base44.auth.me();
      const allowedUsers = await base44.entities.AllowedUser.list();
      const userAccess = allowedUsers.find(allowed => 
        (allowed.data?.email || allowed.email) === user.email
      );
      
      if (userAccess) {
        user.role = userAccess.data?.role || userAccess.role;
      }
      
      setCurrentUser(user);
    };
    
    fetchUserData();
  }, []);

  const { data: allReports = [], isLoading } = useQuery({
    queryKey: ["visitReports"],
    queryFn: () => base44.entities.VisitReport.list("-created_date", 100),
    enabled: !!currentUser,
  });

  const { data: hierarchyData } = useQuery({
    queryKey: ["userHierarchy", currentUser?.email],
    queryFn: () => base44.functions.invoke('getUsersInHierarchy'),
    enabled: !!currentUser,
  });

  // Filtruj raporty według hierarchii
  const reports = React.useMemo(() => {
    if (!currentUser || !hierarchyData?.data) return [];
    
    const allowedEmails = hierarchyData.data.userEmails || [];
    return allReports.filter(report => allowedEmails.includes(report.created_by));
  }, [allReports, hierarchyData, currentUser]);

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.VisitReport.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visitReports"] });
      setSelectedReport(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.VisitReport.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["visitReports"] }),
  });

  const filtered = reports.filter((r) =>
    (r.client_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (r.client_address || "").toLowerCase().includes(search.toLowerCase())
  );

  if (selectedReport) {
    return (
      <ReportDetail
        report={selectedReport}
        onBack={() => setSelectedReport(null)}
        onDelete={() => deleteMutation.mutate(selectedReport.id)}
        onStatusChange={(status) => {
          updateMutation.mutate({ id: selectedReport.id, data: { status } });
          setSelectedReport({ ...selectedReport, status });
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Raporty wizyt"
        subtitle="Dokumentacja wizyt u klientów"
      />

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Szukaj po nazwisku lub adresie..."
          className="pl-10 h-11"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        {[
          { label: "Wszystkie", count: reports.length, color: "text-gray-900" },
          { label: "Szkice", count: reports.filter((r) => r.status === "draft" || !r.status).length, color: "text-gray-600" },
          { label: "Ukończone", count: reports.filter((r) => r.status === "completed" || r.status === "sent").length, color: "text-green-600" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-lg md:rounded-xl border border-gray-200 p-2 md:p-3 text-center">
            <div className={`text-lg md:text-xl font-bold ${stat.color}`}>{stat.count}</div>
            <div className="text-[10px] md:text-xs text-gray-600">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Reports list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 text-sm">
            {search ? "Brak wyników wyszukiwania" : "Brak raportów. Wypełnij checklistę lub wywiad, aby utworzyć raport."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((report, i) => {
            const st = statusConfig[report.status || "draft"];
            return (
              <motion.button
                key={report.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => setSelectedReport(report)}
                className="w-full text-left bg-white rounded-xl border border-gray-200 p-4 hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-[0.99]"
              >
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-sm font-semibold text-gray-900">{report.client_name || "Bez nazwy"}</h3>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 border ${st.color}`}>
                        {st.label}
                      </Badge>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3 text-xs text-gray-600">
                      {report.visit_date && <span>{new Date(report.visit_date).toLocaleDateString("pl-PL")}</span>}
                      {report.client_address && <span className="truncate">{report.client_address}</span>}
                      {report.installation_types?.length > 0 && (
                        <span className="text-green-600">{report.installation_types.join(", ")}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}