import React from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useImpersonation } from "@/lib/useImpersonation";
import { clearImpersonation } from "@/lib/impersonation";

// Czerwono-pomarańczowy banner trybu podglądu. Widoczny na każdej stronie,
// gdy aktywna jest impersonacja. Jedyny sposób zamknięcia to powrót do konta admina.
export default function ImpersonationBanner() {
  const imp = useImpersonation();
  const navigate = useNavigate();

  if (!imp) return null;

  const handleStop = () => {
    clearImpersonation();
    navigate("/Dashboard");
  };

  return (
    <div className="fixed top-14 left-0 right-0 z-[55] bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-lg">
      <div className="max-w-5xl mx-auto px-3 md:px-4 h-10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span className="text-xs sm:text-sm font-semibold truncate">
            Tryb podglądu — zalogowany jako: {imp.targetName} ({imp.targetEmail})
          </span>
        </div>
        <Button
          size="sm"
          onClick={handleStop}
          className="shrink-0 bg-white text-red-600 hover:bg-red-50 h-7 px-3 text-xs font-semibold"
        >
          <LogOut className="w-3.5 h-3.5 mr-1" />
          Wróć do konta admin
        </Button>
      </div>
    </div>
  );
}