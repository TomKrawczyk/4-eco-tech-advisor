import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import useCurrentUser from "@/components/shared/useCurrentUser";
import PageHeader from "@/components/shared/PageHeader";
import AllReportsFilters from "@/components/reports/AllReportsFilters";
import AllReportCard from "@/components/reports/AllReportCard";
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2, ShieldAlert } from "lucide-react";

const phoneResultLabels = {
  interested: "Zainteresowany",
  not_interested: "Niezainteresowany",
  no_answer: "Brak odpowiedzi",
  callback: "Oddzwonić",
  meeting_scheduled: "Spotkanie umówione",
  other: "Inne",
};

export default function AllReports() {
  const { currentUser, accessChecked } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [personFilter, setPersonFilter] = useState("all");
  const [exporting, setExporting] = useState(false);

  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "hr_admin";

  const { data: phoneReports = [], isLoading: loadingPhone } = useQuery({
    queryKey: ["all-phone-contact-reports"],
    queryFn: () => base44.entities.PhoneContactReport.list("-created_date"),
    enabled: accessChecked && isAdmin,
  });

  const { data: phoneContacts = [] } = useQuery({
    queryKey: ["all-phone-contacts-for-reports"],
    queryFn: () => base44.entities.PhoneContact.list(),
    enabled: accessChecked && isAdmin,
  });

  const { data: meetingReports = [], isLoading: loadingMeeting } = useQuery({
    queryKey: ["all-meeting-reports"],
    queryFn: () => base44.entities.MeetingReport.list("-created_date"),
    enabled: accessChecked && isAdmin,
  });

  const { data: visitReports = [], isLoading: loadingVisit } = useQuery({
    queryKey: ["all-visit-reports"],
    queryFn: () => base44.entities.VisitReport.list("-created_date"),
    enabled: accessChecked && isAdmin,
  });

  const { data: serviceReports = [], isLoading: loadingService } = useQuery({
    queryKey: ["all-service-reports"],
    queryFn: () => base44.entities.ServiceReport.list("-created_date"),
    enabled: accessChecked && isAdmin,
  });

  const phoneContactsByKey = useMemo(() => {
    const map = new Map();
    phoneContacts.forEach(contact => map.set(contact.contact_key, contact));
    return map;
  }, [phoneContacts]);

  const reports = useMemo(() => {
    const phone = phoneReports.map(report => {
      const contact = phoneContactsByKey.get(report.contact_key) || {};
      return {
        id: report.id,
        type: "phone",
        client_name: report.client_name,
        client_phone: report.client_phone || contact.phone,
        client_address: report.client_address || contact.address,
        date: report.contact_date || report.created_date,
        resultLabel: phoneResultLabels[report.result] || report.result,
        description: report.description,
        next_steps: report.next_steps,
        author_name: report.author_name,
        author_email: report.author_email,
        assigned_user_name: contact.assigned_user_name,
        assigned_user_email: contact.assigned_user_email,
        searchable: `${report.client_name || ""} ${report.client_phone || ""} ${report.client_address || ""} ${report.description || ""} ${report.next_steps || ""} ${contact.assigned_user_name || ""} ${contact.assigned_user_email || ""}`,
      };
    });

    const meeting = meetingReports.map(report => ({
      id: report.id,
      type: "meeting",
      client_name: report.client_name,
      client_phone: report.client_phone,
      client_address: report.client_address,
      date: report.meeting_date || report.created_date,
      description: report.description,
      next_steps: report.next_steps,
      author_name: report.author_name,
      author_email: report.author_email,
      assigned_user_name: report.author_name,
      assigned_user_email: report.author_email,
      searchable: `${report.client_name || ""} ${report.client_phone || ""} ${report.client_address || ""} ${report.description || ""} ${report.author_name || ""} ${report.author_email || ""}`,
    }));

    const visit = visitReports.map(report => ({
      id: report.id,
      type: "visit",
      client_name: report.client_name,
      client_phone: report.client_phone,
      client_address: report.client_address,
      date: report.visit_date || report.created_date,
      description: report.recommendations || report.additional_notes,
      author_name: report.author_name,
      author_email: report.author_email,
      assigned_user_name: report.author_name,
      assigned_user_email: report.author_email,
      searchable: `${report.client_name || ""} ${report.client_phone || ""} ${report.client_address || ""} ${report.recommendations || ""} ${report.additional_notes || ""} ${report.author_name || ""} ${report.author_email || ""}`,
    }));

    const service = serviceReports.map(report => ({
      id: report.id,
      type: "service",
      client_name: report.client_name,
      client_phone: report.client_phone,
      client_address: report.client_address,
      date: report.service_date || report.created_date,
      description: report.fields ? Object.values(report.fields).filter(Boolean).join("\n") : "",
      author_name: report.author_name,
      author_email: report.author_email,
      assigned_user_name: report.author_name,
      assigned_user_email: report.author_email,
      searchable: `${report.client_name || ""} ${report.client_phone || ""} ${report.client_address || ""} ${report.author_name || ""} ${report.author_email || ""}`,
    }));

    return [...phone, ...meeting, ...visit, ...service].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  }, [phoneReports, phoneContactsByKey, meetingReports, visitReports, serviceReports]);

  const people = useMemo(() => {
    const map = new Map();
    reports.forEach(report => {
      if (report.assigned_user_email) map.set(report.assigned_user_email, report.assigned_user_name || report.assigned_user_email);
    });
    return Array.from(map.entries()).map(([email, name]) => ({ email, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [reports]);

  const filteredReports = useMemo(() => {
    const term = search.toLowerCase();
    return reports.filter(report => {
      const matchesType = typeFilter === "all" || report.type === typeFilter;
      const matchesPerson = personFilter === "all" || report.assigned_user_email === personFilter;
      const matchesSearch = !term || report.searchable.toLowerCase().includes(term);
      return matchesType && matchesPerson && matchesSearch;
    });
  }, [reports, search, typeFilter, personFilter]);

  if (!accessChecked) {
    return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ShieldAlert className="w-12 h-12 text-red-400 mb-3" />
        <p className="text-gray-600">Brak dostępu do wszystkich raportów.</p>
      </div>
    );
  }

  const loading = loadingPhone || loadingMeeting || loadingVisit || loadingService;

  const handleExcelExport = async () => {
    setExporting(true);
    const res = await base44.functions.invoke("exportReports", { type: "excel" });
    const { base64, filename } = res.data;
    const byteChars = atob(base64);
    const byteArr = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
    const blob = new Blob([byteArr], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Wszystkie raporty" subtitle="Raporty po spotkaniach, wizytach, serwisie oraz kontaktach telefonicznych z filtrowaniem po przypisanej osobie" />
        <Button
          onClick={handleExcelExport}
          disabled={exporting}
          className="bg-green-600 hover:bg-green-700 text-white gap-2"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {exporting ? "Generowanie..." : "Eksport Excel"}
        </Button>
      </div>

      <AllReportsFilters
        search={search}
        setSearch={setSearch}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        personFilter={personFilter}
        setPersonFilter={setPersonFilter}
        people={people}
      />

      <div className="text-sm text-gray-500">
        Pokazano <span className="font-semibold text-gray-800">{filteredReports.length}</span> z {reports.length} raportów
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : filteredReports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-gray-500">
          <FileText className="w-12 h-12 text-gray-300 mb-3" />
          <p>Brak raportów spełniających filtry.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReports.map(report => <AllReportCard key={`${report.type}-${report.id}`} report={report} />)}
        </div>
      )}
    </div>
  );
}