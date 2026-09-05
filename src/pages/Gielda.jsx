import React, { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, ShieldAlert, Layers, PanelRightClose, PanelRight, Phone, CalendarClock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import useCurrentUser from "@/components/shared/useCurrentUser";
import {
  fetchGieldaPins,
  claimPin as claimPinFn,
  releasePin as releasePinFn,
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
      const { pins: freshPins, geoByCode: freshGeo, skippedNoCode } = await fetchGieldaPins(currentUser.email);
      setPins(freshPins);
      setGeoByCode(freshGeo);
      setSkippedNoCode(skippedNoCode);
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
        toast.success(`Przejęto: ${pin.client_name || "Klient"}`);
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

  const handleRelease = useCallback(async (pin, reason) => {
    setClaimError("");
    setBusyId(pin.id);
    try {
      const res = await releasePinFn(pin, reason);
      if (res.ok) {
        toast.success(`Oddano na Giełdę: ${pin.client_name || "Klient"}`);
        load(true);
      } else {
        setClaimError(res.reason || "Nie udało się zwolnić.");
      }
    } catch (_e) {
      setClaimError("Wystąpił błąd. Spróbuj ponownie.");
    } finally {
      setBusyId(null);
    }
  }, [load]);

  const handleResign = useCallback(async (pin, reason) => {
    setClaimError("");
    setBusyId(pin.id);
    try {
      const res = await base44.functions.invoke("resignGieldaItem", {
        pin_id: pin.pinId,
        entity_name: pin.source,
        reason,
        client_name: pin.client_name,
        client_phone: pin.client_phone,
        client_address: pin.client_address,
        meeting_date: pin.meeting_date,
      });
      const data = res?.data || res;
      if (data?.ok) {
        toast.success(`Zarchiwizowano: ${pin.client_name || "Klient"}`);
        load(true);
      } else {
        setClaimError(data?.reason || "Nie udało się zarchiwizować.");
      }
    } catch (_e) {
      setClaimError("Wystąpił błąd. Spróbuj ponownie.");
    } finally {
      setBusyId(null);
    }
  }, [load]);

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
              onResign={handleResign}
              onRelease={handleRelease}
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
            onResign={handleResign}
            onRelease={handleRelease}
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

      {skippedNoCode > 0 && (
        <p className="text-[11px] text-gray-400">
          {skippedNoCode} spotkań bez kodu pocztowego.
        </p>
      )}
    </div>
  );
}