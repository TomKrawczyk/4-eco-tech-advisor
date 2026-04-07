import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, Calendar, User, MapPin, Download } from "lucide-react";

export default function ServiceReports() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [generatingPdf, setGeneratingPdf] = useState(null);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["service_reports"],
    queryFn: () => base44.entities.ServiceReport.list("-created_date", 100),
  });

  const filtered = reports.filter(r => {
    const matchSearch = !search ||
      r.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.client_address?.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "all" || r.report_type === filterType;
    return matchSearch && matchType;
  });

  const handleGeneratePdf = async (report) => {
    setGeneratingPdf(report.id);
    try {
      const fnName = report.report_type === "PC" ? "generateChecklistPCPDF" : "generateReportPDF";
      const payload = report.report_type === "PC"
        ? {
            client_name: report.client_name,
            client_phone: report.client_phone,
            client_address: report.client_address,
            worker_signature: report.worker_signature,
            client_signature: report.client_signature,
            photos: report.photos || [],
            fields: report.fields || {},
          }
        : { reportId: report.id };

      const res = await base44.functions.invoke(fnName, payload);
      if (res.data?.pdf_base64) {
        const link = document.createElement("a");
        link.href = `data:application/pdf;base64,${res.data.pdf_base64}`;
        link.download = res.data.filename || `raport_${report.report_type}_${report.client_name}.pdf`;
        link.click();
      }
    } catch (e) {
      console.error(e);
    }
    setGeneratingPdf(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Raporty serwisowe" subtitle="Protokoły PV i PC" />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Szukaj klienta, adresu..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {["all", "PV", "PC"].map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                filterType === t
                  ? t === "PC" ? "bg-orange-50 text-orange-700 border-orange-300"
                    : t === "PV" ? "bg-green-50 text-green-700 border-green-300"
                    : "bg-gray-800 text-white border-gray-800"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}>
              {t === "all" ? "Wszystkie" : t}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Brak raportów serwisowych</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(report => (
            <div key={report.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 truncate">{report.client_name}</span>
                    <Badge className={report.report_type === "PC"
                      ? "bg-orange-100 text-orange-700 border-orange-200"
                      : "bg-green-100 text-green-700 border-green-200"}>
                      {report.report_type}
                    </Badge>
                    <Badge className={report.status === "completed"
                      ? "bg-green-50 text-green-700"
                      : "bg-gray-50 text-gray-500"}>
                      {report.status === "completed" ? "Ukończony" : "Szkic"}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    {report.service_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {report.service_date}
                      </span>
                    )}
                    {report.client_address && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {report.client_address}
                      </span>
                    )}
                    {report.author_name && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {report.author_name}
                      </span>
                    )}
                  </div>
                  {report.photos?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {report.photos.slice(0, 6).map((url, i) => (
                        <img key={i} src={url} alt="" className="w-10 h-10 object-cover rounded border border-gray-200" />
                      ))}
                      {report.photos.length > 6 && (
                        <div className="w-10 h-10 rounded border border-gray-200 bg-gray-100 flex items-center justify-center text-xs text-gray-500">
                          +{report.photos.length - 6}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleGeneratePdf(report)}
                  disabled={generatingPdf === report.id}
                  className="shrink-0">
                  {generatingPdf === report.id
                    ? <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    : <Download className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}