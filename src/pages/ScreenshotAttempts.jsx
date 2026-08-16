import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Camera, ShieldAlert } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import useCurrentUser from "@/components/shared/useCurrentUser";
import ScreenshotAttemptRow from "@/components/security/ScreenshotAttemptRow";

export default function ScreenshotAttempts() {
  const { currentUser, accessChecked } = useCurrentUser();
  const [search, setSearch] = useState("");

  const isAdmin = currentUser?.role === "admin";

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["screenshot_attempts"],
    enabled: isAdmin,
    queryFn: () =>
      base44.entities.ActivityLog.filter({ action_type: "screenshot_attempt" }, "-created_date", 500),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(
      (l) =>
        (l.user_email || "").toLowerCase().includes(q) ||
        (l.user_name || "").toLowerCase().includes(q)
    );
  }, [logs, search]);

  const perUser = useMemo(() => {
    const map = new Map();
    logs.forEach((l) => map.set(l.user_email, (map.get(l.user_email) || 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [logs]);

  if (!accessChecked) return null;

  if (!isAdmin) {
    return (
      <Card className="p-8 text-center">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-red-400" />
        <div className="font-semibold text-gray-900">Brak uprawnień</div>
        <div className="text-sm text-gray-500">Ta sekcja jest dostępna tylko dla administratora.</div>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Próby zrzutów ekranu"
        subtitle="Wykryte próby przechwycenia ekranu w przeglądarce (PrintScreen, Ctrl+P, Ctrl+Shift+S)"
      />

      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Camera className="h-4 w-4 text-gray-400" />
          Łącznie wykrytych prób: <span className="font-semibold text-gray-900">{logs.length}</span>
        </div>
        {perUser.length > 0 && (
          <div className="mt-3 space-y-1">
            {perUser.map(([email, count]) => (
              <div key={email} className="flex justify-between gap-2 text-xs text-gray-600">
                <span className="truncate">{email}</span>
                <span className="font-semibold text-gray-900">{count}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Input
        placeholder="Szukaj po imieniu lub e-mailu..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {isLoading ? (
        <div className="py-10 text-center text-sm text-gray-500">Ładowanie...</div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-gray-500">
          Brak wykrytych prób zrzutu ekranu.
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => (
            <ScreenshotAttemptRow key={log.id} log={log} />
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400">
        Uwaga: wykrywane są tylko próby wykonane z klawiatury w przeglądarce. Zrzuty robione systemowo na
        telefonie nie są widoczne dla aplikacji webowej — chroni je znak wodny.
      </p>
    </div>
  );
}