import React, { useMemo } from "react";
import { Users } from "lucide-react";

export default function AdvisorSummary({ leads }) {
  const counts = useMemo(() => {
    const map = {};
    leads.forEach(l => {
      if (l.is_archived === true || l.is_duplicate === true) return;
      if (!l.assigned_user_email) return;
      const key = l.assigned_user_email;
      if (!map[key]) map[key] = { name: l.assigned_user_name || key, count: 0 };
      map[key].count += 1;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [leads]);

  if (counts.length === 0) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-green-600" />
        <h3 className="text-sm font-semibold text-gray-800">Przypisane kontakty wg handlowca (wszystkie paczki)</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {counts.map(c => (
          <span key={c.name} className="inline-flex items-center gap-1.5 bg-green-50 border border-green-100 text-green-800 rounded-full px-3 py-1 text-xs font-medium">
            {c.name}
            <span className="bg-green-600 text-white rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none">{c.count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}