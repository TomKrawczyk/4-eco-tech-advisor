import React from "react";
import { Badge } from "@/components/ui/badge";

// Uniwersalna lista ukrytych rekordów — każdy wiersz opisany tytułem, datą i metadanymi.
export default function HiddenDataList({ items, getTitle, getDate, getMeta, getBadge, getNote }) {
  if (items.length === 0) {
    return <p className="text-center py-12 text-sm text-gray-400">Brak ukrytych danych w tej kategorii</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={item.id || i} className="bg-white rounded-xl border border-gray-200 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold text-gray-900 text-sm break-words">{getTitle(item)}</div>
              <div className="text-xs text-gray-500 mt-0.5 break-words">{getMeta(item)}</div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="text-[11px] text-gray-400">{getDate(item)}</span>
              {getBadge?.(item) && (
                <Badge className="bg-gray-100 text-gray-700 border border-gray-200 text-[10px]">{getBadge(item)}</Badge>
              )}
            </div>
          </div>
          {getNote?.(item) && (
            <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-600 whitespace-pre-wrap break-words">
              {getNote(item)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}