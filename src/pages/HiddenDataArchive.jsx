import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import useCurrentUser from "@/components/shared/useCurrentUser";
import useIsMainAdmin from "@/components/shared/useIsMainAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/shared/PageHeader";
import { Download, Search, ShieldAlert } from "lucide-react";
import HiddenDataList from "@/components/hidden-data/HiddenDataList";
import { isHiddenFromAdvisor } from "@/components/contact-packages/leadExpiry";
import { isOlderThanDays } from "@/lib/oldRecordVisibility";
import { exportHiddenRecordsToExcel } from "@/lib/hiddenRecordsExcel";

const TABS = [
  { key: "leads", label: "Kontakty z paczek" },
  { key: "phone", label: "Kontakty telefoniczne" },
  { key: "meetings", label: "Raporty po spotkaniach" },
  { key: "calendar", label: "Kalendarz" },
];

export default function HiddenDataArchive() {
  const { currentUser, accessChecked } = useCurrentUser();
  const { isMainAdmin } = useIsMainAdmin();
  const [tab, setTab] = useState("leads");
  const [search, setSearch] = useState("");
  const isAdmin = currentUser?.role === "admin";

  const { data: leads = [], isLoading: loadingLeads } = useQuery({
    queryKey: ["hiddenData-leads"],
    queryFn: () => base44.entities.ContactLead.filter({ status: { $in: ["not_interested", "no_answer", "wrong_number"] } }, "-updated_date", 5000),
    enabled: isAdmin,
  });

  const { data: packages = [] } = useQuery({
    queryKey: ["hiddenData-packages"],
    queryFn: () => base44.entities.ContactPackage.list(),
    enabled: isAdmin,
  });

  const { data: phoneContacts = [], isLoading: loadingPhone } = useQuery({
    queryKey: ["hiddenData-phone"],
    queryFn: () => base44.entities.PhoneContact.list("-contact_date", 5000),
    enabled: isAdmin,
  });

  const { data: meetingReports = [], isLoading: loadingMeetings } = useQuery({
    queryKey: ["hiddenData-meetings"],
    queryFn: () => base44.entities.MeetingReport.list("-meeting_date", 5000),
    enabled: isAdmin,
  });

  const { data: calendarEvents = [], isLoading: loadingCalendar } = useQuery({
    queryKey: ["hiddenData-calendar"],
    queryFn: () => base44.entities.CalendarEvent.list("-event_date", 5000),
    enabled: isAdmin,
  });

  const packageNames = useMemo(() => {
    const map = {};
    packages.forEach(p => { map[p.id] = p.name; });
    return map;
  }, [packages]);

  const hidden = useMemo(() => {
    const now = Date.now();
    return {
      leads: leads.filter(l => isHiddenFromAdvisor(l, now)),
      phone: phoneContacts.filter(c => isOlderThanDays(c.contact_date || c.created_date)),
      meetings: meetingReports.filter(r => isOlderThanDays(r.meeting_date || r.created_date)),
      calendar: calendarEvents.filter(e => isOlderThanDays(e.event_date)),
    };
  }, [leads, phoneContacts, meetingReports, calendarEvents]);

  const matches = (values) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return values.some(v => String(v || "").toLowerCase().includes(q));
  };

  const filtered = useMemo(() => ({
    leads: hidden.leads.filter(l => matches([l.client_name, l.client_phone, l.assigned_user_name, l.assigned_user_email])),
    phone: hidden.phone.filter(c => matches([c.client_name, c.phone, c.assigned_user_name, c.assigned_user_email, c.sheet])),
    meetings: hidden.meetings.filter(r => matches([r.client_name, r.client_phone, r.author_name, r.author_email])),
    calendar: hidden.calendar.filter(e => matches([e.title, e.client_name, e.owner_name, e.owner_email])),
  }), [hidden, search]);

  const isLoading = loadingLeads || loadingPhone || loadingMeetings || loadingCalendar;

  if (!accessChecked) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-center">
        <div>
          <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-gray-600">Ta zakładka jest dostępna tylko dla administratora.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ukryte dane"
        subtitle="Wszystkie rekordy ukryte handlowcom — kontakty z paczek, kontakty telefoniczne, raporty po spotkaniach i kalendarz"
      />

      <div className="flex flex-wrap gap-2">
        {TABS.map(t => (
          <Button
            key={t.key}
            size="sm"
            variant={tab === t.key ? "default" : "outline"}
            onClick={() => setTab(t.key)}
            className={tab === t.key ? "bg-green-600 hover:bg-green-700 text-white" : ""}
          >
            {t.label} ({hidden[t.key].length})
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Szukaj klienta, telefonu, użytkownika..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-11" />
        </div>
        {isMainAdmin && (
          <Button
            variant="outline"
            className="gap-2 h-11 border-green-300 text-green-700 hover:bg-green-50"
            onClick={() => exportHiddenRecordsToExcel({
              leads: filtered.leads,
              phoneContacts: filtered.phone,
              meetingReports: filtered.meetings,
              calendarEvents: filtered.calendar,
              packageNames,
            })}
          >
            <Download className="w-4 h-4" />
            Eksport do Excela
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tab === "leads" ? (
        <HiddenDataList
          items={filtered.leads}
          getTitle={l => l.client_name}
          getMeta={l => [l.client_phone, l.assigned_user_name, packageNames[l.package_id]].filter(Boolean).join(" • ")}
          getDate={l => (l.contacted_at || l.updated_date || "").split("T")[0]}
          getBadge={l => l.status}
        />
      ) : tab === "phone" ? (
        <HiddenDataList
          items={filtered.phone}
          getTitle={c => c.client_name}
          getMeta={c => [c.phone || c.client_phone, c.assigned_user_name, c.sheet].filter(Boolean).join(" • ")}
          getDate={c => c.contact_date || c.date || ""}
          getBadge={c => c.status}
        />
      ) : tab === "meetings" ? (
        <HiddenDataList
          items={filtered.meetings}
          getTitle={r => r.client_name}
          getMeta={r => [r.client_phone, r.author_name].filter(Boolean).join(" • ")}
          getDate={r => r.meeting_date || ""}
          getBadge={r => r.status}
        />
      ) : (
        <HiddenDataList
          items={filtered.calendar}
          getTitle={e => e.title}
          getMeta={e => [e.client_name, e.owner_name, e.location].filter(Boolean).join(" • ")}
          getDate={e => e.event_date || ""}
          getBadge={e => e.event_type}
        />
      )}
    </div>
  );
}