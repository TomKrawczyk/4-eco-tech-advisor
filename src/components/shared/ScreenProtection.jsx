import React, { useEffect, useMemo, useState } from "react";
import { ShieldAlert } from "lucide-react";

function isBlockedShortcut(event) {
  const key = (event.key || "").toLowerCase();
  if (key === "printscreen") return true;
  const hasModifier = event.ctrlKey || event.metaKey;
  return hasModifier && (key === "p" || (event.shiftKey && ["3", "4", "5", "s"].includes(key)));
}

export default function ScreenProtection({ currentUser }) {
  const [shieldVisible, setShieldVisible] = useState(false);
  const [message, setMessage] = useState("");
  const watermark = useMemo(() => {
    const identity = currentUser?.email || currentUser?.displayName || "Użytkownik";
    return `${identity} • WIDOK CHRONIONY • ${window.location.host}`;
  }, [currentUser?.email, currentUser?.displayName]);

  useEffect(() => {
    let timeoutId;

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
      if ((event.key || "").toLowerCase() === "printscreen" && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText("").catch(() => {});
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, []);

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-[45] select-none overflow-hidden" aria-hidden="true">
        <div className="grid h-full w-full grid-cols-2 md:grid-cols-3">
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index} className="flex items-center justify-center overflow-hidden">
              <span className="rotate-[-28deg] text-[10px] font-semibold tracking-[0.35em] text-slate-950/10 md:text-xs">
                {watermark}
              </span>
            </div>
          ))}
        </div>
      </div>

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