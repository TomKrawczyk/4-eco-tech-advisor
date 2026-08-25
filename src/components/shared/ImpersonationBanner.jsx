import React from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, LogOut, X } from "lucide-react";
import { useImpersonation } from "@/lib/useImpersonation";
import { clearImpersonation } from "@/lib/impersonation";

// Pływająca pigułka w prawym dolnym rogu. Nie zasłania nawigacji ani treści.
// Jedyny sposób zamknięcia to powrót do konta admina.
export default function ImpersonationBanner() {
  const imp = useImpersonation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = React.useState(true);

  if (!imp) return null;

  const handleStop = () => {
    clearImpersonation();
    navigate("/Dashboard");
  };

  return (
    <div className="fixed bottom-4 right-4 z-[60] max-w-[calc(100vw-2rem)]">
      <div className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-2xl rounded-full pl-3 pr-1.5 py-1.5 border border-white/20">
        <ShieldAlert className="w-4 h-4 shrink-0" />
        {expanded && (
          <span className="text-xs font-semibold truncate max-w-[180px] sm:max-w-[260px]">
            Podgląd: {imp.targetName} ({imp.targetEmail})
          </span>
        )}
        <button
          onClick={handleStop}
          className="shrink-0 inline-flex items-center gap-1 bg-white text-red-600 hover:bg-red-50 rounded-full h-7 pl-2.5 pr-3 text-xs font-semibold transition-colors"
          title="Wróć do konta admin"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Wróć do admina</span>
        </button>
        <button
          onClick={() => setExpanded(e => !e)}
          className="shrink-0 w-7 h-7 inline-flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
          title={expanded ? "Zwiń" : "Rozwiń"}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}