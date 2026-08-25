import { base44 } from "@/api/base44Client";
import { getImpersonation } from "@/lib/impersonation";

// Wrapper dla logActivity — w trybie impersonacji dokleja email/nazwę
// podglądanego użytkownika oraz admina, który go podgląda.
export function logActivity({ action_type, page_name, details, report_id, metadata }) {
  const imp = getImpersonation();
  const payload = {
    action_type,
    page_name: page_name || null,
    details: details || {},
    report_id: report_id || null,
    metadata: metadata || {},
  };
  if (imp) {
    payload.impersonated_email = imp.targetEmail;
    payload.impersonated_name = imp.targetName;
    payload.impersonated_by = imp.adminEmail;
  }
  return base44.functions.invoke("logActivity", payload).catch((e) => console.error("Log error:", e));
}

export default logActivity;