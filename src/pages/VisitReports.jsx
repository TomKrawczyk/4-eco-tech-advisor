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
  draft: { label: "Szkic", icon: Clock, color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
  completed: { label: "Ukończony", icon: CheckCircle2, color: "bg-green-500/20 text-green-400 border-green-500/30" },
  sent: { label: "Wysłany", icon: Send, color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
};

export default function VisitReports() {
  const [search, setSearch] = useState("");
  const [selectedReport, setSelectedReport] = useState(null);
  const queryClient = useQueryClient();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["visitReports"],
    queryFn: () => base44.entities.VisitReport.list("-created_date", 50),
  });

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
        icon={FileText}
        title="Raporty wizyt"
        subtitle="Dokumentacja wizyt u klientów"
        color="rose"
      />

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Szukaj po nazwisku lub adresie..."
          className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-green-500/50 h-11"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Wszystkie", count: reports.length, color: "text-white" },
          { label: "Szkice", count: reports.filter((r) => r.status === "draft" || !r.status).length, color: "text-gray-400" },
          { label: "Ukończone", count: reports.filter((r) => r.status === "completed" || r.status === "sent").length, color: "text-green-400" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-3 text-center">
            <div className={`text-xl font-bold ${stat.color}`}>{stat.count}</div>
            <div className="text-xs text-gray-500">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Reports list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-5 animate-pulse">
              <div className="h-4 bg-white/10 rounded w-1/3 mb-2" />
              <div className="h-3 bg-white/5 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">
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
                className="w-full text-left bg-white/[0.03] rounded-2xl border border-white/[0.06] p-4 hover:bg-white/[0.05] hover:border-white/10 transition-all active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-white truncate">{report.client_name || "Bez nazwy"}</h3>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 border ${st.color}`}>
                        {st.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {report.visit_date && <span>{new Date(report.visit_date).toLocaleDateString("pl-PL")}</span>}
                      {report.client_address && <span className="truncate">{report.client_address}</span>}
                      {report.installation_types?.length > 0 && (
                        <span className="text-green-500">{report.installation_types.join(", ")}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-600 shrink-0" />
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}