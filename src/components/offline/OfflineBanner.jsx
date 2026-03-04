import React, { useState, useEffect } from "react";
import { WifiOff, Wifi, RefreshCw, AlertCircle } from "lucide-react";
import { getQueue, syncQueue, isOnline } from "./offlineSync";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";

export default function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine);
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState(false);

  const refreshQueueCount = () => {
    setQueueCount(getQueue().length);
  };

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      refreshQueueCount();
      // Auto-sync when coming back online
      autoSync();
    };
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Refresh count periodically
    const interval = setInterval(refreshQueueCount, 5000);
    refreshQueueCount();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  const entityMap = {
    VisitReport: base44.entities.VisitReport,
    Referral: base44.entities.Referral,
    MeetingReport: base44.entities.MeetingReport,
  };

  const autoSync = async () => {
    if (getQueue().length === 0) return;
    setSyncing(true);
    try {
      const { synced } = await syncQueue(entityMap);
      if (synced > 0) {
        setJustSynced(true);
        setTimeout(() => setJustSynced(false), 4000);
      }
    } finally {
      setSyncing(false);
      refreshQueueCount();
    }
  };

  const handleManualSync = () => autoSync();

  // Show banner only when offline OR there are queued items
  const show = !online || queueCount > 0 || justSynced;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -48, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className={`fixed top-14 left-0 right-0 z-40 flex items-center justify-center gap-3 px-4 py-2 text-sm font-medium shadow-md ${
            justSynced
              ? "bg-green-600 text-white"
              : !online
              ? "bg-gray-900 text-white"
              : "bg-amber-500 text-white"
          }`}
        >
          {justSynced ? (
            <>
              <Wifi className="w-4 h-4 shrink-0" />
              Zsynchronizowano dane z serwerem
            </>
          ) : !online ? (
            <>
              <WifiOff className="w-4 h-4 shrink-0" />
              Tryb offline — dane zostaną zsynchronizowane po powrocie do sieci
              {queueCount > 0 && (
                <span className="bg-white/20 rounded-full px-2 py-0.5 text-xs">
                  {queueCount} oczekujących
                </span>
              )}
            </>
          ) : queueCount > 0 ? (
            <>
              <AlertCircle className="w-4 h-4 shrink-0" />
              {queueCount} operacji oczekuje na synchronizację
              <button
                onClick={handleManualSync}
                disabled={syncing}
                className="flex items-center gap-1 bg-white/20 hover:bg-white/30 rounded-full px-3 py-0.5 text-xs transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Synchronizuję..." : "Synchronizuj teraz"}
              </button>
            </>
          ) : null}
        </motion.div>
      )}
    </AnimatePresence>
  );
}