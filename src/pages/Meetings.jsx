import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, RefreshCw, Search, User, MapPin, Phone, Clock, AlertCircle, Table2 } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { motion } from "framer-motion";

export default function Meetings() {
  const [currentUser, setCurrentUser] = useState(null);
  const [accessChecked, setAccessChecked] = useState(false);
  const [search, setSearch] = useState("");
  const [sheetFilter, setSheetFilter] = useState("all");

  React.useEffect(() => {
    const fetchUser = async () => {
      const user = await base44.auth.me();
      const allowedUsers = await base44.entities.AllowedUser.list();
      const ua = allowedUsers.find(a => (a.data?.email || a.email) === user.email);
      if (ua) user.role = ua.data?.role || ua.role;
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

  // Unikalne zakładki
  const sheetTabs = useMemo(() => {
    const tabs = [...new Set(meetings.map(m => m.sheet).filter(Boolean))].sort();
    return tabs;
  }, [meetings]);

  const filtered = useMemo(() => {
    return meetings.filter(m => {
      const matchSheet = sheetFilter === "all" || m.sheet === sheetFilter;
      const matchSearch = !search || Object.values(m).some(v =>
        String(v || "").toLowerCase().includes(search.toLowerCase())
      );
      return matchSheet && matchSearch;
    });
  }, [meetings, sheetFilter, search]);

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Spotkania"
        subtitle={`Leady oznaczone jako "Spotkanie" z arkusza Google Sheets`}
      />

      {/* Pasek narzędzi */}
      <div className="flex flex-wrap gap-2 items-start">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Szukaj klienta, agenta, adresu..."
            className="pl-10 h-11"
          />
        </div>

        {sheetTabs.length > 0 && (
          <Select value={sheetFilter} onValueChange={setSheetFilter}>
            <SelectTrigger className="w-52 h-11">
              <SelectValue placeholder="Wszystkie zakładki" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie ({meetings.length})</SelectItem>
              {sheetTabs.map(tab => (
                <SelectItem key={tab} value={tab}>
                  {tab} ({meetings.filter(m => m.sheet === tab).length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex flex-col items-end gap-1 shrink-0">
          <Button onClick={() => refetch()} variant="outline" className="gap-2 h-11" disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            Odśwież
          </Button>
          {refreshedAt && (
            <span className="text-[10px] text-gray-400">Aktualizacja: {refreshedAt}</span>
          )}
        </div>
      </div>

      {/* Licznik */}
      {!isLoading && meetings.length > 0 && (
        <div className="text-sm text-gray-500">
          Wyświetlono <span className="font-semibold text-gray-800">{filtered.length}</span> z <span className="font-semibold">{meetings.length}</span> spotkań
        </div>
      )}

      {/* Lista */}
      {isLoading || (isFetching && meetings.length === 0) ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
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
          <h3 className="font-semibold text-gray-800 mb-1">Brak spotkań</h3>
          <p className="text-sm text-gray-500 max-w-sm">
            Brak leadów z oznaczeniem "Spotkanie" w arkuszu Google Sheets.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">Brak wyników dla wybranych filtrów</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((meeting, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:border-green-200 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <User className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="font-semibold text-gray-900 text-sm">{meeting.client_name}</span>
                    {/* Zakładka / województwo */}
                    <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-medium">
                      {meeting.sheet}
                    </Badge>
                  </div>

                  {meeting.date && (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      {meeting.date}
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
                      <a href={`tel:${meeting.phone}`} className="hover:text-green-600 transition-colors">
                        {meeting.phone}
                      </a>
                    </div>
                  )}

                  {(meeting.agent || meeting.assigned) && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {meeting.agent && (
                        <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                          Agent: {meeting.agent}
                        </Badge>
                      )}
                      {meeting.assigned && meeting.assigned !== meeting.agent && (
                        <Badge variant="outline" className="text-[10px] bg-gray-50 text-gray-600 border-gray-200">
                          Przypisany: {meeting.assigned}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

                <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px] shrink-0">
                  Spotkanie
                </Badge>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}