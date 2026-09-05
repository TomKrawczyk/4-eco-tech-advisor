import React, { useState, useMemo } from "react";
import { Search, Filter, X } from "lucide-react";
import GieldaPinCard from "./GieldaPinCard";

const FILTERS = [
  { value: "all", label: "Wszystkie" },
  { value: "unassigned", label: "Niepodjęte" },
  { value: "meetings", label: "Spotkania" },
  { value: "mine", label: "Moje" },
];

export default function GieldaSidebar({ pins, geoByCode, currentUser, onClaim, selectedId, onSelect, claimedIds, busyId }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    let list = pins;
    if (filter === "unassigned") list = list.filter((p) => !p.isAssigned);
    else if (filter === "meetings") list = list.filter((p) => p.type === "spotkanie" && !p.isAssigned);
    else if (filter === "mine") list = list.filter((p) => p.assigned_user_email === currentUser?.email);

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
    return list;
  }, [pins, filter, query, geoByCode, currentUser]);

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Wyszukiwarka */}
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
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                filter === f.value ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center text-xs text-gray-400 py-8">Brak pinów do wyświetlenia</div>
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
                claimed={claimedIds.has(pin.id)}
                busy={busyId === pin.id}
              />
            </div>
          ))
        )}
      </div>

      <div className="px-3 py-2 border-t border-gray-100 text-[11px] text-gray-400 flex items-center gap-1">
        <Filter className="w-3 h-3" />
        {filtered.length} z {pins.length} pinów
      </div>
    </div>
  );
}