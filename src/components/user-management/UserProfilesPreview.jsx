import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Phone, ChevronRight, Search, Bell } from "lucide-react";
import UserLiveProfile from "./UserLiveProfile";
import { RoleBadge, StatusBadge } from "./RoleBadge";

function UserRow({ user, meetings, contacts, notifications, groups, onClick }) {
  const email = user.data?.email || user.email;
  const name = user.data?.name || user.name;
  const role = user.data?.role || user.role;
  const groupId = user.data?.group_id || user.group_id;
  const userId = user.id;

  const group = groups.find(g => g.id === groupId);
  const groupName = group?.data?.name || group?.name;

  const managedGroups = role === "group_leader"
    ? groups.filter(g => {
        const leaderIds = g.data?.group_leader_ids || g.group_leader_ids || [];
        const legacyId = g.data?.group_leader_id || g.group_leader_id;
        return leaderIds.includes(userId) || legacyId === userId;
      })
    : [];
  const managedGroupIds = managedGroups.map(g => g.id);

  const userMeetings = meetings.filter(m => m.assigned_user_email === email);
  const groupMeetings = managedGroupIds.length > 0
    ? meetings.filter(m => m.assigned_group_id && managedGroupIds.includes(m.assigned_group_id))
    : [];

  const userContacts = contacts.filter(c => c.assigned_user_email === email);
  const groupContacts = managedGroupIds.length > 0
    ? contacts.filter(c => c.assigned_group_id && managedGroupIds.includes(c.assigned_group_id))
    : [];

  const unreadNotifs = notifications.filter(n => n.user_email === email && !n.is_read);

  const totalMeetings = userMeetings.length + groupMeetings.length;
  const totalContacts = userContacts.length + groupContacts.length;

  return (
    <button
      className="w-full bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-green-300 hover:shadow-sm transition-all flex items-center gap-3"
      onClick={() => onClick(user)}
    >
      <RoleBadge user={user} variant="icon-only" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-gray-900 text-sm">{name}</span>
          <RoleBadge user={user} />
          <StatusBadge user={user} />
          {groupName && (
            <Badge className="text-[10px] bg-orange-50 text-orange-700 border-orange-200">{groupName}</Badge>
          )}
          {managedGroups.map(g => (
            <Badge key={g.id} className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
              {g.data?.name || g.name}
            </Badge>
          ))}
        </div>
        <div className="text-xs text-gray-400 truncate mt-0.5">{email}</div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {unreadNotifs.length > 0 && (
          <div className="flex items-center gap-1">
            <Bell className="w-3.5 h-3.5 text-yellow-500" />
            <span className="text-xs font-semibold text-yellow-600">{unreadNotifs.length}</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 text-green-500" />
          <span className="text-sm font-semibold text-green-700">{totalMeetings}</span>
        </div>
        <div className="flex items-center gap-1">
          <Phone className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-sm font-semibold text-blue-700">{totalContacts}</span>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400" />
      </div>
    </button>
  );
}

export default function UserProfilesPreview({ allowedUsers, groups }) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);

  const { data: meetings = [] } = useQuery({
    queryKey: ["meetingAssignments"],
    queryFn: () => base44.entities.MeetingAssignment.list(),
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["phoneContactsDB"],
    queryFn: () => base44.entities.PhoneContact.list(),
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ["allNotifications"],
    queryFn: () => base44.entities.Notification.list(),
  });

  // Normalize
  const norm = (x) => ({ ...x, ...(x.data || {}) });
  const normalizedMeetings = meetings.map(norm);
  const normalizedContacts = contacts.map(norm);
  const normalizedNotifications = notifications.map(norm);

  const filtered = allowedUsers.filter(u => {
    const name = (u.data?.name || u.name || "").toLowerCase();
    const email = (u.data?.email || u.email || "").toLowerCase();
    const role = u.data?.role || u.role;
    const matchSearch = name.includes(search.toLowerCase()) || email.includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || role === roleFilter;
    return matchSearch && matchRole;
  });

  if (selectedUser) {
    return (
      <UserLiveProfile
        user={selectedUser}
        groups={groups}
        allUsers={allowedUsers}
        onBack={() => setSelectedUser(null)}
      />
    );
  }

  const totalMeetings = normalizedMeetings.filter(m => m.assigned_user_email).length;
  const totalContacts = normalizedContacts.filter(c => c.assigned_user_email).length;
  const totalUnread = normalizedNotifications.filter(n => !n.is_read).length;

  return (
    <div className="space-y-4">
      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{totalMeetings}</div>
          <div className="text-xs text-gray-500 mt-0.5">Przypisanych spotkań</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-blue-600">{totalContacts}</div>
          <div className="text-xs text-gray-500 mt-0.5">Przypisanych kontaktów</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-yellow-500">{totalUnread}</div>
          <div className="text-xs text-gray-500 mt-0.5">Nieprzeczytanych powd.</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Szukaj..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-40 h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie role</SelectItem>
            <SelectItem value="user">Handlowiec</SelectItem>
            <SelectItem value="team_leader">Team Leader</SelectItem>
            <SelectItem value="group_leader">Group Leader</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-gray-400">Kliknij na użytkownika, aby zobaczyć jego profil na żywo</p>

      {/* User rows */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">Brak użytkowników</p>
        ) : (
          filtered.map(user => (
            <UserRow
              key={user.id}
              user={user}
              meetings={normalizedMeetings}
              contacts={normalizedContacts}
              notifications={normalizedNotifications}
              groups={groups}
              onClick={setSelectedUser}
            />
          ))
        )}
      </div>
    </div>
  );
}