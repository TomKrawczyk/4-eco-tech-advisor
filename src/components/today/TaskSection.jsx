import React from "react";

// Sekcja zadań z nagłówkiem i licznikiem
export default function TaskSection({ title, icon: Icon, count, emptyText, children }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-green-600" />}
        <h2 className="font-semibold text-gray-900 text-sm">{title}</h2>
        <span className="text-xs text-gray-500">({count})</span>
      </div>
      {count === 0 ? (
        <p className="text-xs text-gray-500 bg-white rounded-xl border border-gray-200 p-3">{emptyText}</p>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </div>
  );
}