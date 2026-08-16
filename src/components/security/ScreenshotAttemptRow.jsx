import React from "react";
import { Card } from "@/components/ui/card";
import { Camera } from "lucide-react";

export default function ScreenshotAttemptRow({ log }) {
  const when = log.created_date ? new Date(log.created_date).toLocaleString("pl-PL") : "—";
  const page = (log.page_name || "").replace(/^#\/?/, "") || "—";

  return (
    <Card className="p-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50">
          <Camera className="h-4 w-4 text-red-500" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-gray-900 truncate">
            {log.user_name || log.user_email}
          </div>
          <div className="text-xs text-gray-500 truncate">{log.user_email}</div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-600">
            <span>{when}</span>
            <span className="truncate">Strona: {page}</span>
            {log.details?.key && <span>Klawisz: {log.details.key}</span>}
          </div>
          {log.details?.user_agent && (
            <div className="mt-1 text-[10px] text-gray-400 line-clamp-2">{log.details.user_agent}</div>
          )}
        </div>
      </div>
    </Card>
  );
}