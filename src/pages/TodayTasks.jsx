import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import useCurrentUser from "@/components/shared/useCurrentUser";
import PageHeader from "@/components/shared/PageHeader";
import TaskSection from "@/components/today/TaskSection";
import TaskCard from "@/components/today/TaskCard";
import { PhoneCall, CalendarClock, AlarmClock } from "lucide-react";

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
  const today = todayStr();

  const { data: myLeads = [], isLoading: loadingLeads } = useQuery({
    queryKey: ["today-leads", email],
    queryFn: () => base44.entities.ContactLead.filter({ assigned_user_email: email }, "-assigned_at", 1000),
    enabled: !!email,
  });

  const { data: myPhoneReports = [], isLoading: loadingReports } = useQuery({
    queryKey: ["today-phoneReports", email],
    queryFn: () => base44.entities.PhoneContactReport.filter({ author_email: email }, "-created_date", 500),
    enabled: !!email,
  });

  const { data: myEvents = [], isLoading: loadingEvents } = useQuery({
    queryKey: ["today-events", email],
    queryFn: () => base44.entities.CalendarEvent.filter({ owner_email: email }, "-event_date", 500),
    enabled: !!email,
  });

  // Do oddzwonienia: leady ze statusem "callback" + raporty telefoniczne z datą oddzwonienia na dziś lub zaległą
  const callbacks = useMemo(() => {
    const leadItems = myLeads
      .filter(l => l.status === "callback" && !l.is_archived)
      .map(l => ({
        id: `lead-${l.id}`,
        title: l.client_name,
        meta: [l.client_phone, l.client_address].filter(Boolean).join(" • "),
        note: l.contact_notes || "",
        phone: l.client_phone,
        address: l.client_address,
        badge: "Oddzwonić",
        badgeClass: "bg-amber-100 text-amber-700",
        sortKey: l.contacted_at || "",
      }));

    const reportItems = myPhoneReports
      .filter(r => r.callback_date && r.callback_date <= today)
      .map(r => ({
        id: `report-${r.id}`,
        title: r.client_name,
        meta: [r.client_phone, r.client_address].filter(Boolean).join(" • "),
        note: [r.description, r.next_steps].filter(Boolean).join("\n"),
        phone: r.client_phone,
        address: r.client_address,
        badge: r.callback_date === today ? "Dziś" : `Zaległe: ${r.callback_date}`,
        badgeClass: r.callback_date === today ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700",
        sortKey: r.callback_date,
      }));

    return [...reportItems, ...leadItems].sort((a, b) => String(a.sortKey).localeCompare(String(b.sortKey)));
  }, [myLeads, myPhoneReports, today]);

  // Spotkania na dziś z kalendarza + umówione spotkania z leadów
  const meetings = useMemo(() => {
    const events = myEvents
      .filter(e => e.event_date === today && e.status !== "cancelled")
      .map(e => ({
        id: `event-${e.id}`,
        title: e.title || e.client_name || "Wydarzenie",
        meta: [e.event_time, e.client_name, e.location].filter(Boolean).join(" • "),
        note: e.description || "",
        phone: e.client_phone,
        address: e.location,
        badge: e.event_time || "Dziś",
        badgeClass: "bg-green-100 text-green-700",
        sortKey: e.event_time || "99:99",
      }));

    const leadMeetings = myLeads
      .filter(l => l.scheduled_meeting_date === today && !l.is_archived)
      .map(l => ({
        id: `leadmeet-${l.id}`,
        title: l.client_name,
        meta: [l.scheduled_meeting_time, l.client_phone, l.client_address].filter(Boolean).join(" • "),
        note: l.contact_notes || "",
        phone: l.client_phone,
        address: l.client_address,
        badge: l.scheduled_meeting_time || "Dziś",
        badgeClass: "bg-green-100 text-green-700",
        sortKey: l.scheduled_meeting_time || "99:99",
      }));

    return [...events, ...leadMeetings].sort((a, b) => String(a.sortKey).localeCompare(String(b.sortKey)));
  }, [myEvents, myLeads, today]);

  // Leady bez ruchu: przypisane lub po pierwszym kontakcie, bez aktywności od kilku dni
  const staleLeads = useMemo(() => {
    return myLeads
      .filter(l => !l.is_archived && ["assigned", "contacted", "interested"].includes(l.status))
      .map(l => ({ lead: l, days: daysSince(l.contacted_at || l.assigned_at) }))
      .filter(x => x.days !== null && x.days >= STALE_DAYS)
      .sort((a, b) => b.days - a.days)
      .map(({ lead: l, days }) => ({
        id: `stale-${l.id}`,
        title: l.client_name,
        meta: [l.client_phone, l.client_address].filter(Boolean).join(" • "),
        note: l.contact_notes || "",
        phone: l.client_phone,
        address: l.client_address,
        badge: `${days} dni bez ruchu`,
        badgeClass: "bg-orange-100 text-orange-700",
      }));
  }, [myLeads]);

  if (!accessChecked || loadingLeads || loadingReports || loadingEvents) {
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
        subtitle={total === 0 ? "Brak zaległości — wszystko na bieżąco" : `${total} rzeczy do ogarnięcia dzisiaj`}
      />

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
        emptyText="Wszystkie Twoje leady są aktualne."
      >
        {staleLeads.map(item => <TaskCard key={item.id} {...item} />)}
      </TaskSection>
    </div>
  );
}