import React from "react";

export default function LeadExtraData({ lead, className = "" }) {
  const extra = lead?.extra_data;
  if (!extra || typeof extra !== "object" || Object.keys(extra).length === 0) return null;

  return (
    <div className={`bg-blue-50 rounded-lg p-3 ${className}`}>
      <div className="text-xs font-semibold text-blue-700 uppercase mb-2">Dodatkowe informacje z importu</div>
      <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2 text-sm">
        {Object.entries(extra).map(([key, value]) => (
          <div key={key} className="flex gap-1.5 min-w-0">
            <span className="text-gray-500 shrink-0">{key}:</span>
            <span className="text-gray-800 break-words min-w-0">{String(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}