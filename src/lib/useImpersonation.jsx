import { useState, useEffect } from "react";
import { getImpersonation } from "@/lib/impersonation";

// Hook reagujący na zmiany stanu impersonacji (CustomEvent + storage).
export function useImpersonation() {
  const [state, setState] = useState(() => getImpersonation());

  useEffect(() => {
    const handler = () => setState(getImpersonation());
    window.addEventListener("impersonation-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("impersonation-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  return state;
}

export default useImpersonation;