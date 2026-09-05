import React, { useState, useMemo } from "react";
import { Search, X, Filter } from "lucide-react";
import GieldaPinCard from "./GieldaPinCard";

const CONTACT_FILTERS = [
  { value: "all", label: "Wszystkie" },
  { value: "hot", label: "Nowe leady" },
  { value: "callback", label: "Do ponownego" },
  { value: "mine", label: "Moje" },
];

const MEETING_FILTERS = [
  { value: "all", label: "Wszystkie" },
  { value: "today", label: "Dziś" },
  { value: "tomorrow", label: "Jutro" },
  { value: "mine", label: "Moje" },
];

function todayISO() { return new Date().toISOString().split("T")[0]; }
function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

export default function GieldaSidebar({ pins, geoByCode, currentUser, onClaim, onResign, onRelease, selectedId, onSelect, claimedIds, busyId, tab }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");

  const filters = tab === "meeting" ? MEETING_FILTERS : CONTACT_FILTERS;
  const mineCount = useMemo(
    () => pins.filter((p) => p.isAssigned && p.assigned_user_email === currentUser?.email).length,
    [pins, currentUser]
  );

  const filtered = useMemo(() => {
    let list = pins;
    if (tab === "meeting") {
      const today = todayISO();
      const tomorrow = tomorrowISO();
      if (filter === "today") list = list.filter((p) => p.meeting_date === today);
      else if (filter === "tomorrow") list = list.filter((p) => p.meeting_date === tomorrow);
      else if (filter === "mine") list = list.filter((p) => p.isAssigned && p.assigned_user_email === currentUser?.email);
    } else {
      if (filter === "all") list = list.filter((p) => !p.isAssigned);
      else if (filter === "hot") list = list.filter((p) => !p.isAssigned && p.source === "PhoneContact" && p.phone_status === "Kontakt do doradcy");
      else if (filter === "callback") list = list.filter((p) => !p.isAssigned && p.source === "PhoneContact" && p.phone_status === "Do ponownego kontaktu");
      else if (filter === "mine") list = list.filter((p) => p.isAssigned && p.assigned_user_email === currentUser?.email);
    }

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((p) => {
        const city = (geoByCode[p.postal_code]?.city || "").toLowerCase();
        return (
          p.postal_code.toLowerCase().includes(q) ||
          city.includes(q) ||
          (p.client_name || "").toLowerCase().includes(q)
        );
      });
    }

    return [...list].sort((a, b) => {
      if (tab === "meeting") {
        // Chronologicznie — najbliższe u góry, po dacie a potem po terminie z arkusza
        const da = a.meeting_date || "9999";
        const db = b.meeting_date || "9999";
        if (da !== db) return da.localeCompare(db);
        return (a.meeting_calendar || "").localeCompare(b.meeting_calendar || "");
      }
      // Kontakty — najnowsze u góry
      return new Date(b.created_date || 0) - new Date(a.created_date || 0);
    });
  }, [pins, filter, query, geoByCode, currentUser, tab]);

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      <div className="p-3 border-b border-gray-100 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj kodu / miasta / klienta"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400"
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {filters.map((f) => {
            const isMine = f.value === "mine";
            return (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                  filter === f.value ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {f.label}
                {isMine && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    filter === "mine" ? "bg-white/25 text-white" : "bg-gray-200 text-gray-600"
                  }`}>
                    {mineCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center text-xs text-gray-400 py-8">Brak pozycji do wyświetlenia</div>
        ) : (
          filtered.map((pin) => (
            <div
              key={pin.id}
              onClick={() => onSelect(pin)}
              className={`cursor-pointer rounded-lg transition-all ${selectedId === pin.id ? "ring-2 ring-green-500" : ""}`}
            >
              <GieldaPinCard
                pin={pin}
                geo={geoByCode[pin.postal_code]}
                currentUser={currentUser}
                onClaim={onClaim}
                onResign={onResign}
                onRelease={onRelease}
                claimed={claimedIds.has(pin.id)}
                busy={busyId === pin.id}
              />
            </div>
          ))
        )}
      </div>

      <div className="px-3 py-2 border-t border-gray-100 text-[11px] text-gray-400 flex items-center gap-1">
        <Filter className="w-3 h-3" />
        {filtered.length} z {pins.length} pozycji
      </div>
    </div>
  );
}