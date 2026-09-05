import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Loader2, RefreshCw, ShieldAlert, Layers, PanelRightClose, PanelRight, Phone, CalendarClock } from "lucide-react";
import useCurrentUser from "@/components/shared/useCurrentUser";
import {
  fetchGieldaPins,
  geocodeInBatches,
  claimPin as claimPinFn,
} from "@/lib/gieldaData";
import GieldaStats from "@/components/gielda/GieldaStats";
import GieldaSidebar from "@/components/gielda/GieldaSidebar";
import GieldaMap from "@/components/gielda/GieldaMap";

const POLL_MS = 15 * 1000;

export default function Gielda() {
  const { currentUser } = useCurrentUser();
  const [pins, setPins] = useState([]);
  const [geoByCode, setGeoByCode] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [claimedIds, setClaimedIds] = useState(new Set());
  const [busyId, setBusyId] = useState(null);
  const [claimError, setClaimError] = useState("");
  const [flyTo, setFlyTo] = useState(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [missingCount, setMissingCount] = useState(0);
  const [skippedNoCode, setSkippedNoCode] = useState(0);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [tab, setTab] = useState(() => {
    try { return localStorage.getItem("gielda_tab") === "meeting" ? "meeting" : "contact"; } catch (_) { return "contact"; }
  });

  useEffect(() => {
    try { localStorage.setItem("gielda_tab", tab); } catch (_) {}
  }, [tab]);

  const isAdmin = currentUser?.role === "admin";

  const load = useCallback(async (silent = false) => {
    if (!currentUser?.email) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const { pins: freshPins, skippedNoCode } = await fetchGieldaPins(currentUser.email);
      setSkippedNoCode(skippedNoCode);
      // Zachowaj geokodowane kody z poprzedniego cyklu
      setGeoByCode((prev) => {
        const next = { ...prev };
        const newCodes = freshPins
          .map((p) => p.postal_code)
          .filter((c) => !next[c]);
        if (newCodes.length > 0) {
          geocodeInBatches(newCodes, (geo, missing) => {
            setGeoByCode((cur) => ({ ...cur, ...geo }));
            setMissingCount((m) => m + missing.length);
          });
        }
        // czyścimy kody których już nie ma
        const keep = {};
        for (const c of Object.keys(next)) {
          if (freshPins.some((p) => p.postal_code === c)) keep[c] = next[c];
        }
        return keep;
      });
      setPins(freshPins);
      setLastRefresh(new Date());
    } catch (_e) {
      // błąd pobierania — zostaw stare dane
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser?.email]);

  // Pierwsze pobranie + polling
  useEffect(() => {
    if (!currentUser?.email) return;
    load(false);
    const id = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(id);
  }, [currentUser?.email, load]);

  const handleClaim = useCallback(async (pin) => {
    setClaimError("");
    setBusyId(pin.id);
    try {
      const res = await claimPinFn(pin, currentUser);
      if (res.ok) {
        setClaimedIds((prev) => new Set(prev).add(pin.id));
        // natychmiast odśwież piny
        load(true);
      } else {
        setClaimError(res.reason || "Nie udało się przejąć.");
      }
    } catch (_e) {
      setClaimError("Wystąpił błąd. Spróbuj ponownie.");
    } finally {
      setBusyId(null);
    }
  }, [currentUser, load]);

  const handleSelect = useCallback((pin) => {
    setSelectedId(pin.id);
    const g = geoByCode[pin.postal_code];
    if (g) setFlyTo([g.lat, g.lon]);
  }, [geoByCode]);

  const selectedPin = useMemo(() => pins.find((p) => p.id === selectedId) || null, [pins, selectedId]);

  const contactCount = useMemo(() => pins.filter((p) => p.type === "kontakt").length, [pins]);
  const meetingCount = useMemo(() => pins.filter((p) => p.type === "spotkanie").length, [pins]);
  const tabPins = useMemo(
    () => (tab === "meeting" ? pins.filter((p) => p.type === "spotkanie") : pins.filter((p) => p.type === "kontakt")),
    [pins, tab]
  );

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-green-600" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="text-center max-w-sm">
          <ShieldAlert className="w-14 h-14 text-red-400 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-gray-900 mb-1">Moduł w wersji pilotowej</h2>
          <p className="text-sm text-gray-600">
            "Giełda kontaktów i spotkań" jest obecnie dostępna tylko dla administratora.
            Dostęp dla handlowców zostanie włączony po zakończeniu testów.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Nagłówek */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-green-600" />
            Giełda kontaktów i spotkań
            <span className="text-[10px] font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">PILOT</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Mapa leadów i spotkań na żywo {lastRefresh && `• Ostatnia aktualizacja: ${lastRefresh.toLocaleTimeString()}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Odśwież
          </button>
          <button
            onClick={() => setShowSidebar((v) => !v)}
            className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {showSidebar ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRight className="w-3.5 h-3.5" />}
            Panel
          </button>
        </div>
      </div>

      {claimError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 flex items-center justify-between">
          <span>{claimError}</span>
          <button onClick={() => setClaimError("")} className="text-red-400 hover:text-red-600">×</button>
        </div>
      )}

      {/* Segmented control — podział na zakładki */}
      <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl">
        <button
          onClick={() => setTab("contact")}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === "contact" ? "bg-white shadow text-green-700 font-semibold" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Phone className="w-4 h-4" />
          Kontakt telefoniczny
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === "contact" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"}`}>
            {contactCount}
          </span>
        </button>
        <button
          onClick={() => setTab("meeting")}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === "meeting" ? "bg-white shadow text-blue-700 font-semibold" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <CalendarClock className="w-4 h-4" />
          Spotkanie
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === "meeting" ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-500"}`}>
            {meetingCount}
          </span>
        </button>
      </div>

      <GieldaStats pins={tabPins} currentUserEmail={currentUser.email} tab={tab} />

      {/* Mapa + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-3 h-[calc(100vh-320px)] min-h-[420px]">
        {showSidebar && (
          <div className="lg:h-full h-64 lg:h-auto overflow-hidden rounded-xl border border-gray-200 lg:order-1 order-2">
            <GieldaSidebar
              pins={tabPins}
              geoByCode={geoByCode}
              currentUser={currentUser}
              onClaim={handleClaim}
              selectedId={selectedId}
              onSelect={handleSelect}
              claimedIds={claimedIds}
              busyId={busyId}
              tab={tab}
            />
          </div>
        )}
        <div className="relative rounded-xl border border-gray-200 overflow-hidden lg:order-2 order-1 min-h-[300px]">
          <GieldaMap
            pins={tabPins}
            geoByCode={geoByCode}
            currentUser={currentUser}
            onClaim={handleClaim}
            claimedIds={claimedIds}
            busyId={busyId}
            selectedId={selectedId}
            onSelect={handleSelect}
            flyTo={flyTo}
            tab={tab}
          />
          {loading && (
            <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-white/90 backdrop-blur px-2.5 py-1.5 rounded-lg shadow text-xs text-gray-600 z-[500]">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-green-600" />
              Ładowanie pinów…
            </div>
          )}
        </div>
      </div>

      {(missingCount > 0 || skippedNoCode > 0) && (
        <p className="text-[11px] text-gray-400">
          {skippedNoCode > 0 && `${skippedNoCode} spotkań bez kodu pocztowego. `}
          {missingCount > 0 && `${missingCount} kodów nie udało się zgeokodować.`}
        </p>
      )}
    </div>
  );
}