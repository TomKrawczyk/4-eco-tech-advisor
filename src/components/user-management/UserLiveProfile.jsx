import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Phone, Bell, Users, ArrowLeft, BellRing, CheckCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { RoleBadge, StatusBadge } from "./RoleBadge";

export default function UserLiveProfile({ user, groups, allUsers, onBack }) {
  const email = user.data?.email || user.email;
  const name = user.data?.name || user.name;
  const role = user.data?.role || user.role;
  const groupId = user.data?.group_id || user.group_id;
  const userId = user.id;

  const group = groups.find(g => g.id === groupId);
  const groupName = group?.data?.name || group?.name;

  // Grupy zarządzane przez group leadera
  const managedGroups = role === "group_leader"
    ? groups.filter(g => {
        const leaderIds = g.data?.group_leader_ids || g.group_leader_ids || [];
        const legacyId = g.data?.group_leader_id || g.group_leader_id;
        return leaderIds.includes(userId) || legacyId === userId;
      })
    : [];
  const managedGroupIds = managedGroups.map(g => g.id);

  const { data: meetings = [] } = useQuery({
    queryKey: ["meetingAssignments"],
    queryFn: () => base44.entities.MeetingAssignment.list(),
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["phoneContactsDB"],
    queryFn: () => base44.entities.PhoneContact.list(),
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ["notificationsFor", email],
    queryFn: () => base44.entities.Notification.filter({ user_email: email }),
  });

  // Normalizacja
  const norm = (arr) => arr.map(x => ({ ...x, ...(x.data || {}) }));
  const normalizedMeetings = norm(meetings);
  const normalizedContacts = norm(contacts);
  const normalizedNotifications = norm(notifications);

  // Spotkania przypisane do tej osoby
  const userMeetings = normalizedMeetings.filter(m => m.assigned_user_email === email);
  // Spotkania przypisane do grup zarządzanych (bez przypisanego usera)
  const groupMeetings = managedGroupIds.length > 0
    ? normalizedMeetings.filter(m => m.assigned_group_id && managedGroupIds.includes(m.assigned_group_id) && !m.assigned_user_email)
    : [];
  // Wszystkie spotkania grupy (już przypisane do handlowca też)
  const allGroupMeetings = managedGroupIds.length > 0
    ? normalizedMeetings.filter(m => m.assigned_group_id && managedGroupIds.includes(m.assigned_group_id))
    : [];

  const userContacts = normalizedContacts.filter(c => c.assigned_user_email === email);
  const groupContacts = managedGroupIds.length > 0
    ? normalizedContacts.filter(c => c.assigned_group_id && managedGroupIds.includes(c.assigned_group_id) && !c.assigned_user_email)
    : [];

  const unreadNotifications = normalizedNotifications.filter(n => !n.is_read);
  const recentNotifications = normalizedNotifications.slice(0, 10);

  return (
    <div className="space-y-4">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 text-gray-600 hover:text-gray-900 -ml-2">
        <ArrowLeft className="w-4 h-4" />
        Wróć do listy
      </Button>

      {/* User header */}
       <div className="bg-white border border-gray-200 rounded-xl p-5">
         <div className="flex items-center gap-4">
           <RoleBadge user={user} variant="icon-only" />
           <div className="flex-1 min-w-0">
             <div className="flex items-center gap-2 flex-wrap">
               <span className="text-xl font-bold text-gray-900">{name}</span>
               <RoleBadge user={user} />
               <StatusBadge user={user} />
               {groupName && (
                 <Badge className="bg-orange-50 text-orange-700 border-orange-200">{groupName}</Badge>
               )}
             </div>
             <div className="text-sm text-gray-500 mt-1">{email}</div>
             {managedGroups.length > 0 && (
               <div className="flex gap-1 mt-1 flex-wrap">
                 {managedGroups.map(g => (
                   <Badge key={g.id} className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                     Zarządza: {g.data?.name || g.name}
                   </Badge>
                 ))}
               </div>
             )}
           </div>
          {/* Stats */}
          <div className="flex gap-4 shrink-0">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{userMeetings.length + allGroupMeetings.length}</div>
              <div className="text-xs text-gray-500">Spotkania</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{userContacts.length + groupContacts.length}</div>
              <div className="text-xs text-gray-500">Kontakty</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${unreadNotifications.length > 0 ? "text-red-500" : "text-gray-400"}`}>
                {unreadNotifications.length}
              </div>
              <div className="text-xs text-gray-500">Nowe powd.</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Powiadomienia */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <BellRing className="w-4 h-4 text-yellow-500" />
            Powiadomienia
            {unreadNotifications.length > 0 && (
              <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">{unreadNotifications.length} nowych</Badge>
            )}
          </h4>
          {recentNotifications.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-4 text-center">Brak powiadomień</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {recentNotifications.map((n, i) => (
                <div key={n.id || i} className={`text-xs rounded-lg px-3 py-2 border ${n.is_read ? "bg-gray-50 border-gray-100 text-gray-500" : "bg-yellow-50 border-yellow-200 text-gray-800"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-1.5">
                      {n.is_read
                        ? <CheckCircle className="w-3 h-3 text-gray-400 mt-0.5 shrink-0" />
                        : <Bell className="w-3 h-3 text-yellow-500 mt-0.5 shrink-0" />
                      }
                      <div>
                        <div className="font-medium">{n.title}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">{n.message}</div>
                      </div>
                    </div>
                    {n.created_date && (
                      <span className="text-[10px] text-gray-400 shrink-0 whitespace-nowrap">
                        {format(new Date(n.created_date), "dd.MM HH:mm")}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Spotkania grupy do przypisania */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-orange-500" />
            Spotkania grupy do przypisania
            {groupMeetings.length > 0 && (
              <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-[10px]">{groupMeetings.length}</Badge>
            )}
          </h4>
          {groupMeetings.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-4 text-center">Brak nieprzypisanych spotkań w grupie</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {groupMeetings.map((m, i) => (
                <div key={m.id || i} className="flex items-start gap-2 text-xs bg-orange-50 rounded-lg px-3 py-2 border border-orange-200">
                  <Clock className="w-3 h-3 text-orange-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-800">{m.client_name}</span>
                    {m.meeting_calendar && <span className="text-gray-500 ml-1">– {m.meeting_calendar}</span>}
                    <div className="text-[10px] text-orange-600 mt-0.5">{m.assigned_group_name || managedGroups.find(g => g.id === m.assigned_group_id)?.data?.name}</div>
                  </div>
                  <Badge className="text-[9px] bg-white text-orange-600 border-orange-200 shrink-0">{m.sheet}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Spotkania osobiste */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-green-500" />
            Spotkania przypisane ({userMeetings.length})
          </h4>
          {userMeetings.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-4 text-center">Brak przypisanych spotkań</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {userMeetings.map((m, i) => (
                <div key={m.id || i} className="flex items-start gap-2 text-xs bg-green-50 rounded-lg px-3 py-2 border border-green-200">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-800">{m.client_name}</span>
                    {m.meeting_calendar && <span className="text-gray-500 ml-1">– {m.meeting_calendar}</span>}
                  </div>
                  <Badge className="text-[9px] bg-white text-green-600 border-green-200 shrink-0">{m.sheet}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Kontakty telefoniczne */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Phone className="w-4 h-4 text-blue-500" />
            Kontakty telefoniczne ({userContacts.length + groupContacts.length})
          </h4>
          {userContacts.length === 0 && groupContacts.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-4 text-center">Brak przypisanych kontaktów</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {groupContacts.length > 0 && (
                <div className="text-[10px] font-semibold text-orange-600 uppercase tracking-wide px-1 mb-1">
                  Grupy – do przypisania ({groupContacts.length})
                </div>
              )}
              {groupContacts.map((c, i) => (
                <div key={`g-${c.id || i}`} className="flex items-start gap-2 text-xs bg-orange-50 rounded-lg px-3 py-2 border border-orange-200">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-800">{c.client_name}</span>
                    {c.phone && <span className="text-gray-500 ml-1">– {c.phone}</span>}
                  </div>
                  <Badge className="text-[9px] bg-white text-orange-600 border-orange-200 shrink-0">{c.sheet}</Badge>
                </div>
              ))}
              {userContacts.length > 0 && groupContacts.length > 0 && (
                <div className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide px-1 mb-1 mt-2">
                  Osobiste ({userContacts.length})
                </div>
              )}
              {userContacts.map((c, i) => (
                <div key={`u-${c.id || i}`} className="flex items-start gap-2 text-xs bg-blue-50 rounded-lg px-3 py-2 border border-blue-200">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-800">{c.client_name}</span>
                    {c.phone && <span className="text-gray-500 ml-1">– {c.phone}</span>}
                  </div>
                  <Badge className="text-[9px] bg-white text-blue-600 border-blue-200 shrink-0">{c.sheet}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}