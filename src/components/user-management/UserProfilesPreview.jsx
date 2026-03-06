import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Phone, Users, User, ChevronDown, ChevronRight, Search, Shield, Crown } from "lucide-react";

const roleConfig = {
  admin: { label: "Admin", color: "bg-purple-100 text-purple-700 border-purple-200", icon: Shield },
  group_leader: { label: "Group Leader", color: "bg-blue-100 text-blue-700 border-blue-200", icon: Crown },
  team_leader: { label: "Team Leader", color: "bg-green-100 text-green-700 border-green-200", icon: Users },
  user: { label: "Handlowiec", color: "bg-gray-100 text-gray-700 border-gray-200", icon: User },
};

function UserCard({ user, meetings, contacts, groups, allUsers }) {
  const [expanded, setExpanded] = useState(false);
  const email = user.data?.email || user.email;
  const name = user.data?.name || user.name;
  const role = user.data?.role || user.role;
  const groupId = user.data?.group_id || user.group_id;
  const userId = user.id;

  const rc = roleConfig[role] || roleConfig.user;
  const Icon = rc.icon;

  const userMeetings = meetings.filter(m => m.assigned_user_email === email);
  const userContacts = contacts.filter(c => c.assigned_user_email === email);

  const group = groups.find(g => g.id === groupId);
  const groupName = group?.data?.name || group?.name;

  // Dla group leadera: znajdź grupy którymi zarządza i spotkania przypisane do tych grup
  const managedGroups = role === "group_leader"
    ? groups.filter(g => {
        const leaderIds = g.data?.group_leader_ids || g.group_leader_ids || [];
        const legacyId = g.data?.group_leader_id || g.group_leader_id;
        return leaderIds.includes(userId) || legacyId === userId;
      })
    : [];
  const managedGroupIds = managedGroups.map(g => g.id);
  const groupMeetings = managedGroupIds.length > 0
    ? meetings.filter(m => m.assigned_group_id && managedGroupIds.includes(m.assigned_group_id))
    : [];
  const groupContacts = managedGroupIds.length > 0
    ? contacts.filter(c => c.assigned_group_id && managedGroupIds.includes(c.assigned_group_id))
    : [];

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-green-200 transition-colors">
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${rc.color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 text-sm">{name}</span>
            <Badge className={`text-[10px] border ${rc.color}`}>{rc.label}</Badge>
            {groupName && (
              <Badge className="text-[10px] bg-orange-50 text-orange-700 border-orange-200">{groupName}</Badge>
            )}
          </div>
          <div className="text-xs text-gray-500 truncate mt-0.5">{email}</div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-green-500" />
            <span className="text-sm font-semibold text-green-700">{userMeetings.length + groupMeetings.length}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-sm font-semibold text-blue-700">{userContacts.length + groupContacts.length}</span>
          </div>
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-4 bg-gray-50">
          {/* Meetings */}
          <div>
            <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-green-500" />
              Spotkania ({userMeetings.length})
            </h4>
            {userMeetings.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Brak przypisanych spotkań</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {userMeetings.map((m, i) => (
                  <div key={m.id || i} className="flex items-start gap-2 text-xs bg-white rounded-lg px-3 py-2 border border-gray-200">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-800">{m.client_name || m.data?.client_name}</span>
                      {(m.meeting_calendar || m.data?.meeting_calendar) && (
                        <span className="text-gray-400 ml-1">– {m.meeting_calendar || m.data?.meeting_calendar}</span>
                      )}
                    </div>
                    <Badge className="text-[9px] bg-blue-50 text-blue-600 border-blue-100 shrink-0">
                      {m.sheet || m.data?.sheet}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Phone Contacts */}
          <div>
            <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-blue-500" />
              Kontakty telefoniczne ({userContacts.length})
            </h4>
            {userContacts.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Brak przypisanych kontaktów</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {userContacts.map((c, i) => (
                  <div key={c.id || i} className="flex items-start gap-2 text-xs bg-white rounded-lg px-3 py-2 border border-gray-200">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-800">{c.client_name || c.data?.client_name}</span>
                      {(c.phone || c.data?.phone) && (
                        <span className="text-gray-400 ml-1">– {c.phone || c.data?.phone}</span>
                      )}
                    </div>
                    <Badge className="text-[9px] bg-green-50 text-green-600 border-green-100 shrink-0">
                      {c.sheet || c.data?.sheet}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function UserProfilesPreview({ allowedUsers, groups }) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const { data: meetings = [] } = useQuery({
    queryKey: ["meetingAssignments"],
    queryFn: () => base44.entities.MeetingAssignment.list(),
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["phoneContactsDB"],
    queryFn: () => base44.entities.PhoneContact.list(),
  });

  const filtered = allowedUsers.filter(u => {
    const name = (u.data?.name || u.name || "").toLowerCase();
    const email = (u.data?.email || u.email || "").toLowerCase();
    const role = u.data?.role || u.role;
    const matchSearch = name.includes(search.toLowerCase()) || email.includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || role === roleFilter;
    return matchSearch && matchRole;
  });

  // Normalize meetings/contacts data
  const normalizedMeetings = meetings.map(m => ({
    id: m.id,
    assigned_user_email: m.data?.assigned_user_email || m.assigned_user_email,
    client_name: m.data?.client_name || m.client_name,
    meeting_calendar: m.data?.meeting_calendar || m.meeting_calendar,
    sheet: m.data?.sheet || m.sheet,
  })).filter(m => m.assigned_user_email);

  const normalizedContacts = contacts.map(c => ({
    id: c.id,
    assigned_user_email: c.data?.assigned_user_email || c.assigned_user_email,
    client_name: c.data?.client_name || c.client_name,
    phone: c.data?.phone || c.phone,
    sheet: c.data?.sheet || c.sheet,
  })).filter(c => c.assigned_user_email);

  const totalMeetings = normalizedMeetings.length;
  const totalContacts = normalizedContacts.length;
  const assignedMeetings = new Set(normalizedMeetings.map(m => m.assigned_user_email)).size;

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
          <div className="text-2xl font-bold text-purple-600">{assignedMeetings}</div>
          <div className="text-xs text-gray-500 mt-0.5">Handlowców z zadaniami</div>
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

      {/* User cards */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">Brak użytkowników</p>
        ) : (
          filtered.map(user => (
            <UserCard
              key={user.id}
              user={user}
              meetings={normalizedMeetings}
              contacts={normalizedContacts}
              groups={groups}
              allUsers={allowedUsers}
            />
          ))
        )}
      </div>
    </div>
  );
}