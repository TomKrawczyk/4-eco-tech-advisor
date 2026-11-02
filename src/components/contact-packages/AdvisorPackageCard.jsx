import React from "react";
import { Package, Users, Lock, ChevronRight } from "lucide-react";

export default function AdvisorPackageCard({ pkg, total, handled, onClick }) {
  const pct = total > 0 ? Math.round((handled / total) * 100) : 0;
  const ownerLabel = pkg.assigned_user_name || pkg.assigned_user_email;

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white border border-green-100 rounded-xl p-4 hover:border-green-300 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-green-50 border border-green-100 flex items-center justify-center">
          <Package className="w-5 h-5 text-green-600" />
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300" />
      </div>

      <h3 className="font-semibold text-green-900 mb-1">{pkg.name}</h3>

      {pkg.is_private ? (
        <p className="text-xs text-purple-700 font-medium mb-2 flex items-center gap-1">
          <Lock className="w-3 h-3" /> Prywatna{ownerLabel ? ` — ${ownerLabel}` : ""}
        </p>
      ) : pkg.group_name ? (
        <p className="text-xs text-green-700 font-medium mb-2">{pkg.group_name}</p>
      ) : null}

      <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
        <span className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          {total} {total === 1 ? "kontakt" : "kontaktów"}
        </span>
        <span>{pct}% obdzwonionych</span>
      </div>

      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-3 text-xs text-gray-400">
        {pkg.created_date ? new Date(pkg.created_date).toLocaleDateString("pl-PL") : ""}
      </div>
    </button>
  );
}