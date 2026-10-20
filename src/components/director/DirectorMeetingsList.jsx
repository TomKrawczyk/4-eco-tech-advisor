import React, { useMemo, useState } from "react";
import { Search } from "lucide-react";
import MeetingCard from "@/components/meetings/MeetingCard";

export default function DirectorMeetingsList({
  meetings,
  groupNameById,
  loading,
  assignmentByKey,
  salespeople,
  managedGroups,
  allAllowedUsers,
  currentUser,
}) {
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [scope, setScope] = useState("all");
  const [limit, setLimit] = useState(30);

  const groupIds = useMemo(
    () => [...new Set(meetings.map((m) => m.groupId).filter(Boolean))],
    [meetings],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return meetings.filter((m) => {
      if (scope === "upcoming" && !m.isUpcoming) return false;
      if (groupFilter !== "all" && m.groupId !== groupFilter) return false;
      if (!q) return true;
      return [m.client_name, m.sheet, m.assignedName, m.assignedEmail, m.client_phone, m.client_address]
        .some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [meetings, search, groupFilter, scope]);

  if (loading) {
    return <div className="text-sm text-gray-400 py-6 text-center">Ładowanie spotkań…</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szukaj klienta, handlowca…"
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-green-400"
          />
        </div>
        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
        >
          <option value="all">Wszystkie grupy</option>
          {groupIds.map((gid) => (
            <option key={gid} value={gid}>{groupNameById[gid] || gid}</option>
          ))}
        </select>
        <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => setScope("all")}
            className={`px-2.5 py-1.5 text-xs ${scope === "all" ? "bg-green-500 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            Wszystkie
          </button>
          <button
            onClick={() => setScope("upcoming")}
            className={`px-2.5 py-1.5 text-xs ${scope === "upcoming" ? "bg-green-500 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            Nadchodzące
          </button>
        </div>
        <span className="text-xs text-gray-400">{filtered.length} spotkań</span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-10 text-sm text-gray-500">Brak spotkań w Twojej strukturze.</div>
      ) : (
        <>
          <div className="space-y-2">
            {filtered.slice(0, limit).map((m, i) => (
              <MeetingCard
                key={m.meeting_key || i}
                meeting={m}
                assignment={assignmentByKey?.[m.meeting_key] || null}
                salespeople={salespeople || []}
                currentUserRole={currentUser?.role}
                currentUserEmail={currentUser?.email}
                groups={managedGroups || []}
                allAllowedUsers={allAllowedUsers || []}
              />
            ))}
          </div>
          {filtered.length > limit && (
            <button
              onClick={() => setLimit((l) => l + 50)}
              className="w-full text-sm text-green-700 hover:bg-green-50 py-2 rounded-lg border border-green-200"
            >
              Pokaż więcej ({filtered.length - limit} pozostało)
            </button>
          )}
        </>
      )}
    </div>
  );
}