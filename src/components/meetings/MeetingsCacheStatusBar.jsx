import React from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MeetingsCacheStatusBar({ refreshedAt, status, onRefresh, isRefreshing }) {
  const statusLabel = status === "error"
    ? "Ostatnia synchronizacja nie powiodła się"
    : status === "refreshing" || isRefreshing
      ? "Trwa aktualizacja danych"
      : refreshedAt
        ? `Zaktualizowano: ${refreshedAt}`
        : "Brak danych w cache";

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
      <span className="text-xs text-gray-500">{statusLabel}</span>
      <Button onClick={onRefresh} variant="outline" size="sm" className="gap-2" disabled={isRefreshing}>
        <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
        Odśwież teraz
      </Button>
    </div>
  );
}