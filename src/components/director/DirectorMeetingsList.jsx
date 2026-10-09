import React, { useMemo, useState } from "react";
import { Search, Calendar, User, MapPin, Phone, Clock, FileText } from "lucide-react";

export default function DirectorMeetingsList({ meetings, groupNameById, loading }) {
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [limit, setLimit] = useState(30);

  const groupIds = useMemo(
    () => [...new Set(meetings.map((m) => m.groupId).filter(Boolean))],
    [meetings],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return meetings.filter((m) => {
      if (groupFilter !== "all" && m.groupId !== groupFilter) return false;
      if (!q) return true;
      return [m.client_name, m.sheet, m.assignedName, m.assignedEmail, m.client_phone, m.client_address]
        .some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [meetings, search, groupFilter]);

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
        <span className="text-xs text-gray-400">{filtered.length} spotkań</span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-10 text-sm text-gray-500">Brak nadchodzących spotkań w Twojej strukturze.</div>
      ) : (
        <>
          <div className="space-y-2">
            {filtered.slice(0, limit).map((m, i) => (
              <div key={m.meeting_key || i} className="bg-white rounded-xl border border-gray-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 text-sm truncate">{m.client_name || "—"}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                      {m.sheet && <span className="inline-flex items-center gap-1"><FileText className="w-3 h-3" />{m.sheet}</span>}
                      {m.groupId && groupNameById[m.groupId] && (
                        <span className="inline-flex items-center gap-1 text-emerald-700">{groupNameById[m.groupId]}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-medium text-gray-700 flex items-center gap-1 justify-end">
                      <Calendar className="w-3 h-3 text-green-600" />
                      {m.meeting_date}
                    </div>
                    {m.time && (
                      <div className="text-[11px] text-gray-400 flex items-center gap-1 justify-end">
                        <Clock className="w-3 h-3" />{m.time}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-1 text-gray-500 min-w-0 truncate">
                    <User className="w-3 h-3 shrink-0" />
                    <span className="truncate">{m.assignedName || (m.assignedEmail ? m.assignedEmail : "Nieprzypisane")}</span>
                  </div>
                  {(m.client_phone || m.phone) && (
                    <span className="inline-flex items-center gap-1 text-gray-400">
                      <Phone className="w-3 h-3" />{m.client_phone || m.phone}
                    </span>
                  )}
                </div>
              </div>
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