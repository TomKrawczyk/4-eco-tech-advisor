import React, { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { base44 } from "@/api/base44Client";

function isBlockedShortcut(event) {
  const key = (event.key || "").toLowerCase();
  if (key === "printscreen") return true;
  const hasModifier = event.ctrlKey || event.metaKey;
  return hasModifier && (key === "p" || (event.shiftKey && ["3", "4", "5", "s"].includes(key)));
}

export default function ScreenProtection({ currentUser }) {
  const [shieldVisible, setShieldVisible] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let timeoutId;
    let lastLogged = 0;

    const logAttempt = async (key) => {
      if (Date.now() - lastLogged < 1500) return;
      lastLogged = Date.now();
      let email = currentUser?.email;
      let name = currentUser?.displayName || currentUser?.full_name || "";
      if (!email) {
        try {
          const me = await base44.auth.me();
          email = me?.email;
          name = name || me?.full_name || "";
        } catch (_) {}
      }
      if (!email) return;
      base44.entities.ActivityLog.create({
        user_email: email,
        user_name: name,
        action_type: "screenshot_attempt",
        page_name: window.location.hash || window.location.pathname,
        details: { key, user_agent: navigator.userAgent }
      }).catch(() => {});
    };

    const showShield = (nextMessage) => {
      setMessage(nextMessage || "");
      setShieldVisible(true);
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        if (!document.hidden && document.hasFocus()) {
          setShieldVisible(false);
          setMessage("");
        }
      }, 1800);
    };

    const handleVisibilityChange = () => setShieldVisible(document.hidden || !document.hasFocus());
    const handleBlur = () => setShieldVisible(true);
    const handleFocus = () => {
      if (!document.hidden) setShieldVisible(false);
    };
    const handleContextMenu = (event) => event.preventDefault();
    const handleKeyDown = (event) => {
      if (!isBlockedShortcut(event)) return;
      event.preventDefault();
      event.stopPropagation();
      showShield("Wykryto próbę przechwycenia ekranu");
      logAttempt(event.key);
      if ((event.key || "").toLowerCase() === "printscreen" && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText("").catch(() => {});
      }
    };
    // PrintScreen w Windows często trafia tylko do keyup
    const handleKeyUp = (event) => {
      if ((event.key || "").toLowerCase() !== "printscreen") return;
      showShield("Wykryto próbę przechwycenia ekranu");
      logAttempt(event.key);
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText("").catch(() => {});
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);

    return () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
    };
  }, [currentUser]);

  return (
    <>
      {shieldVisible && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/96 backdrop-blur-md">
          <div className="flex max-w-sm flex-col items-center gap-3 px-6 text-center text-white">
            <ShieldAlert className="h-10 w-10 text-red-400" />
            <div className="text-lg font-semibold">Widok chroniony</div>
            <div className="text-sm text-slate-300">
              {message || "Zawartość została chwilowo zasłonięta, aby utrudnić wykonanie zrzutu ekranu."}
            </div>
          </div>
        </div>
      )}
    </>
  );
}