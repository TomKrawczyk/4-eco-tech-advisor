import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import useCurrentUser from "@/components/shared/useCurrentUser";
import PageHeader from "@/components/shared/PageHeader";
import TaskSection from "@/components/today/TaskSection";
import TaskCard from "@/components/today/TaskCard";
import AdvisorFilter from "@/components/today/AdvisorFilter";
import { PhoneCall, CalendarClock, AlarmClock } from "lucide-react";
import { buildClosedClientKeys, isClientClosed, looksClosed } from "@/lib/closedClients";

const STALE_DAYS = 3;

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}

export default function TodayTasks() {
  const { currentUser, accessChecked } = useCurrentUser();
  const email = currentUser?.email;
  const isAdmin = currentUser?.role === "admin";
  const today = todayStr();
  const [advisor, setAdvisor] = useState("all");

  const { data: allLeads = [], isLoading: loadingLeads } = useQuery({
    queryKey: ["today-leads", email, isAdmin],
    queryFn: () => isAdmin
      ? base44.entities.ContactLead.list("-assigned_at", 5000)
      : base44.entities.ContactLead.filter({ assigned_user_email: email }, "-assigned_at", 1000),
    enabled: !!email,
  });

  const { data: allPhoneReports = [], isLoading: loadingReports } = useQuery({
    queryKey: ["today-phoneReports", email, isAdmin],
    queryFn: () => isAdmin
      ? base44.entities.PhoneContactReport.list("-created_date", 5000)
      : base44.entities.PhoneContactReport.filter({ author_email: email }, "-created_date", 500),
    enabled: !!email,
  });

  const { data: allEvents = [], isLoading: loadingEvents } = useQuery({
    queryKey: ["today-events", email, isAdmin],
    queryFn: () => isAdmin
      ? base44.entities.CalendarEvent.list("-event_date", 5000)
      : base44.entities.CalendarEvent.filter({ owner_email: email }, "-event_date", 500),
    enabled: !!email,
  });

  const { data: allMeetingReports = [], isLoading: loadingMeetingReports } = useQuery({
    queryKey: ["today-meetingReports", email, isAdmin],
    queryFn: () => isAdmin
      ? base44.entities.MeetingReport.list("-meeting_date", 5000)
      : base44.entities.MeetingReport.filter({ author_email: email }, "-meeting_date", 500),
    enabled: !!email,
  });

  // Lista handlowców do filtra (tylko admin)
  const people = useMemo(() => {
    if (!isAdmin) return [];
    const map = {};
    allLeads.forEach(l => { if (l.assigned_user_email) map[l.assigned_user_email] = l.assigned_user_name; });
    allPhoneReports.forEach(r => { if (r.author_email) map[r.author_email] = map[r.author_email] || r.author_name; });
    allEvents.forEach(e => { if (e.owner_email) map[e.owner_email] = map[e.owner_email] || e.owner_name; });
    return Object.entries(map)
      .map(([email, name]) => ({ email, name }))
      .sort((a, b) => String(a.name || a.email).localeCompare(String(b.name || b.email)));
  }, [isAdmin, allLeads, allPhoneReports, allEvents]);

  const leads = useMemo(
    () => (advisor === "all" ? allLeads : allLeads.filter(l => l.assigned_user_email === advisor)),
    [allLeads, advisor]
  );
  const phoneReports = useMemo(
    () => (advisor === "all" ? allPhoneReports : allPhoneReports.filter(r => r.author_email === advisor)),
    [allPhoneReports, advisor]
  );
  const events = useMemo(
    () => (advisor === "all" ? allEvents : allEvents.filter(e => e.owner_email === advisor)),
    [allEvents, advisor]
  );

  const ownerLabel = (name, email) => (isAdmin ? name || email || "" : "");

  // Klienci z podpisaną umową / sprzedażą wg treści raportów — nie są zaległi
  const closedKeys = useMemo(
    () => buildClosedClientKeys([allPhoneReports, allMeetingReports]),
    [allPhoneReports, allMeetingReports]
  );
  const isClosed = (lead) => isClientClosed(closedKeys, lead);

  // Do oddzwonienia: leady z paczek ze statusem "callback" + raporty telefoniczne z datą oddzwonienia na dziś lub zaległą
  const callbacks = useMemo(() => {
    const leadItems = leads
      .filter(l => l.status === "callback" && !l.is_archived && !isClosed(l))
      .map(l => {
        const days = daysSince(l.contacted_at || l.assigned_at);
        const overdue = days !== null && days >= 1;
        return {
          id: `lead-${l.id}`,
          title: l.client_name,
          meta: [l.client_phone, l.client_address, ownerLabel(l.assigned_user_name, l.assigned_user_email)].filter(Boolean).join(" • "),
          note: l.contact_notes || "",
          phone: l.client_phone,
          address: l.client_address,
          badge: overdue ? `Zaległe: ${days} dni` : "Oddzwonić",
          badgeClass: overdue ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700",
          sortKey: l.contacted_at || "",
        };
      });

    const reportItems = phoneReports
      .filter(r => r.callback_date && r.callback_date <= today && !looksClosed(r.description, r.next_steps))
      .map(r => ({
        id: `report-${r.id}`,
        title: r.client_name,
        meta: [r.client_phone, r.client_address, ownerLabel(r.author_name, r.author_email)].filter(Boolean).join(" • "),
        note: [r.description, r.next_steps].filter(Boolean).join("\n"),
        phone: r.client_phone,
        address: r.client_address,
        badge: r.callback_date === today ? "Dziś" : `Zaległe: ${r.callback_date}`,
        badgeClass: r.callback_date === today ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700",
        sortKey: r.callback_date,
      }));

    return [...reportItems, ...leadItems].sort((a, b) => String(a.sortKey).localeCompare(String(b.sortKey)));
  }, [leads, phoneReports, today, isAdmin, closedKeys]);

  // Spotkania na dziś z kalendarza + umówione spotkania z leadów
  const meetings = useMemo(() => {
    const eventItems = events
      .filter(e => e.event_date === today && e.status !== "cancelled")
      .map(e => ({
        id: `event-${e.id}`,
        title: e.title || e.client_name || "Wydarzenie",
        meta: [e.event_time, e.client_name, e.location, ownerLabel(e.owner_name, e.owner_email)].filter(Boolean).join(" • "),
        note: e.description || "",
        phone: e.client_phone,
        address: e.location,
        badge: e.event_time || "Dziś",
        badgeClass: "bg-green-100 text-green-700",
        sortKey: e.event_time || "99:99",
      }));

    const leadMeetings = leads
      .filter(l => l.scheduled_meeting_date === today && !l.is_archived)
      .map(l => ({
        id: `leadmeet-${l.id}`,
        title: l.client_name,
        meta: [l.scheduled_meeting_time, l.client_phone, l.client_address, ownerLabel(l.assigned_user_name, l.assigned_user_email)].filter(Boolean).join(" • "),
        note: l.contact_notes || "",
        phone: l.client_phone,
        address: l.client_address,
        badge: l.scheduled_meeting_time || "Dziś",
        badgeClass: "bg-green-100 text-green-700",
        sortKey: l.scheduled_meeting_time || "99:99",
      }));

    return [...eventItems, ...leadMeetings].sort((a, b) => String(a.sortKey).localeCompare(String(b.sortKey)));
  }, [events, leads, today, isAdmin]);

  // Leady bez ruchu z paczek kontaktów
  const staleLeads = useMemo(() => {
    return leads
      .filter(l => !l.is_archived && ["assigned", "contacted", "interested"].includes(l.status) && !isClosed(l))
      .map(l => ({ lead: l, days: daysSince(l.contacted_at || l.assigned_at) }))
      .filter(x => x.days !== null && x.days >= STALE_DAYS)
      .sort((a, b) => b.days - a.days)
      .map(({ lead: l, days }) => ({
        id: `stale-${l.id}`,
        title: l.client_name,
        meta: [l.client_phone, l.client_address, ownerLabel(l.assigned_user_name, l.assigned_user_email)].filter(Boolean).join(" • "),
        note: l.contact_notes || "",
        phone: l.client_phone,
        address: l.client_address,
        badge: `${days} dni bez ruchu`,
        badgeClass: "bg-orange-100 text-orange-700",
      }));
  }, [leads, isAdmin, closedKeys]);

  if (!accessChecked || loadingLeads || loadingReports || loadingEvents || loadingMeetingReports) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const total = callbacks.length + meetings.length + staleLeads.length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dziś do zrobienia"
        subtitle={
          isAdmin
            ? "Zadania wszystkich handlowców — oddzwonienia, spotkania i leady bez ruchu"
            : total === 0
              ? "Brak zaległości — wszystko na bieżąco"
              : `${total} rzeczy do ogarnięcia dzisiaj`
        }
      />

      {isAdmin && (
        <AdvisorFilter people={people} value={advisor} onChange={setAdvisor} />
      )}

      <TaskSection
        title="Do oddzwonienia"
        icon={PhoneCall}
        count={callbacks.length}
        emptyText="Brak kontaktów do oddzwonienia."
      >
        {callbacks.map(item => <TaskCard key={item.id} {...item} />)}
      </TaskSection>

      <TaskSection
        title="Spotkania dzisiaj"
        icon={CalendarClock}
        count={meetings.length}
        emptyText="Brak spotkań zaplanowanych na dziś."
      >
        {meetings.map(item => <TaskCard key={item.id} {...item} />)}
      </TaskSection>

      <TaskSection
        title={`Leady bez ruchu (${STALE_DAYS}+ dni)`}
        icon={AlarmClock}
        count={staleLeads.length}
        emptyText="Wszystkie leady są aktualne."
      >
        {staleLeads.map(item => <TaskCard key={item.id} {...item} />)}
      </TaskSection>
    </div>
  );
}