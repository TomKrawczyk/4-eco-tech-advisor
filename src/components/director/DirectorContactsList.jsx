import React, { useMemo, useState } from "react";
import { Search, Phone, User, FileText } from "lucide-react";

export default function DirectorContactsList({ contacts, groupNameById, loading }) {
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [limit, setLimit] = useState(30);

  const groupIds = useMemo(
    () => [...new Set(contacts.map((c) => c.groupId).filter(Boolean))],
    [contacts],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return contacts.filter((c) => {
      if (groupFilter !== "all" && c.groupId !== groupFilter) return false;
      if (!q) return true;
      return [c.client_name, c.sheet, c.assignedName, c.assignedEmail, c.phone, c.client_phone]
        .some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [contacts, search, groupFilter]);

  if (loading) {
    return <div className="text-sm text-gray-400 py-6 text-center">Ładowanie kontaktów…</div>;
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
        <span className="text-xs text-gray-400">{filtered.length} kontaktów</span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-10 text-sm text-gray-500">Brak aktywnych kontaktów w Twojej strukturze.</div>
      ) : (
        <>
          <div className="space-y-2">
            {filtered.slice(0, limit).map((c, i) => {
              const phone = c.phone || c.client_phone || "";
              return (
                <div key={c.contact_key || i} className="bg-white rounded-xl border border-gray-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 text-sm truncate">{c.client_name || "—"}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5 flex flex-wrap gap-x-2">
                        {c.sheet && <span className="inline-flex items-center gap-1"><FileText className="w-3 h-3" />{c.sheet}</span>}
                        {c.groupId && groupNameById[c.groupId] && (
                          <span className="text-emerald-700">{groupNameById[c.groupId]}</span>
                        )}
                      </div>
                    </div>
                    {phone && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 shrink-0">
                        <Phone className="w-3 h-3" />{phone}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-[11px] text-gray-500">
                    <User className="w-3 h-3 shrink-0" />
                    <span className="truncate">{c.assignedName || (c.assignedEmail ? c.assignedEmail : "Nieprzypisane")}</span>
                  </div>
                </div>
              );
            })}
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