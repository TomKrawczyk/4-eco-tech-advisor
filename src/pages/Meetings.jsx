import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Calendar, RefreshCw, Search, User, MapPin, Phone, Clock, AlertCircle, Table2 } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { motion } from "framer-motion";

export default function Meetings() {
  const [currentUser, setCurrentUser] = useState(null);
  const [accessChecked, setAccessChecked] = useState(false);
  const [search, setSearch] = useState("");

  React.useEffect(() => {
    const fetchUser = async () => {
      const user = await base44.auth.me();
      const allowedUsers = await base44.entities.AllowedUser.list();
      const ua = allowedUsers.find(a => (a.data?.email || a.email) === user.email);
      if (ua) {
        user.role = ua.data?.role || ua.role;
      }
      setCurrentUser(user);
      setAccessChecked(true);
    };
    fetchUser();
  }, []);

  const { data: result, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["sheetMeetings"],
    queryFn: () => base44.functions.invoke("getMeetingsFromSheets").then(r => r.data),
    enabled: accessChecked && currentUser?.role === "admin",
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const meetings = result?.meetings || [];
  const refreshedAt = result?.refreshed_at ? new Date(result.refreshed_at).toLocaleTimeString("pl-PL") : null;

  if (!accessChecked) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-7 h-7 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (currentUser?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
        <p className="text-gray-700 font-medium">Brak dostępu – tylko dla administratora</p>
      </div>
    );
  }

  const filtered = meetings.filter(m =>
    !search ||
    Object.values(m).some(v => String(v || "").toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Spotkania" subtitle="Spotkania pobierane z arkusza Google Sheets" />

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Szukaj..."
            className="pl-10 h-11"
          />
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Button
            onClick={() => refetch()}
            variant="outline"
            className="gap-2"
            disabled={isFetching}
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            Odśwież
          </Button>
          {refreshedAt && (
            <span className="text-[10px] text-gray-400">Ostatnia aktualizacja: {refreshedAt}</span>
          )}
        </div>
      </div>

      {isLoading || isFetching ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : meetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Table2 className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="font-semibold text-gray-800 mb-1">Brak danych z arkusza</h3>
          <p className="text-sm text-gray-500 max-w-sm">
            Gdy skonfigurujesz strukturę arkusza Google Sheets, spotkania będą się tutaj wyświetlać automatycznie.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">Brak wyników wyszukiwania</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((meeting, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5 flex-1 min-w-0">
                  {meeting.client_name && (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="font-semibold text-gray-900 text-sm">{meeting.client_name}</span>
                    </div>
                  )}
                  {meeting.date && (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      {meeting.date}
                      {meeting.time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{meeting.time}</span>}
                    </div>
                  )}
                  {meeting.address && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      {meeting.address}
                    </div>
                  )}
                  {meeting.phone && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      {meeting.phone}
                    </div>
                  )}
                  {meeting.agent && (
                    <div className="mt-1">
                      <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                        {meeting.agent}
                      </Badge>
                    </div>
                  )}
                </div>
                {meeting.status && (
                  <Badge variant="outline" className="text-[10px] shrink-0">{meeting.status}</Badge>
                )}
              </div>
              {/* Raw data fallback for unknown structure */}
              {!meeting.client_name && !meeting.date && (
                <pre className="text-xs text-gray-500 whitespace-pre-wrap">{JSON.stringify(meeting, null, 2)}</pre>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}