import { base44 } from "@/api/base44Client";

// Po złożeniu/edycji/usunięciu raportu sprawdza na nowo blokady (enforceReportingBlocks)
// i odświeża stan dostępu w layoucie — dzięki temu konto odblokowuje się automatycznie,
// gdy wszystkie zaległe raporty zostaną uzupełnione.
export function refreshReportingBlock() {
  try { sessionStorage.removeItem("layout_user_cache"); } catch (e) {}
  base44
    .functions.invoke("enforceReportingBlocks", {})
    .then(() => window.dispatchEvent(new Event("user-access-updated")))
    .catch(() => {});
}