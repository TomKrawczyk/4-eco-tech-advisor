// Klientowa warstwa impersonacji (admin "Zaloguj jako").
// Platforma własną sesję (token), dlatego impersonacja jest warstwą nad useCurrentUser:
// email/rola/grupa w aplikacji pochodzą z tego stanu, a nie z tokena admina.

const KEY = "impersonation_state";

export function getImpersonation() {
  try {
    const v = localStorage.getItem(KEY);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

export function isImpersonating() {
  return !!getImpersonation();
}

function notify() {
  try {
    window.dispatchEvent(new Event("impersonation-changed"));
  } catch (_) {}
}

// Rozpoczyna podgląd jako wybrany użytkownik.
// target: { email, name, role, group_id?, allowedUserId? }
export function startImpersonation(adminEmail, adminName, target) {
  if (!target?.email) throw new Error("Brak emaila użytkownika docelowego");
  if ((target.role || "advisor") === "admin") {
    throw new Error("Nie można wejść w tryb podglądu jako administrator");
  }
  const state = {
    adminEmail,
    adminName: adminName || adminEmail,
    targetEmail: target.email,
    targetName: target.name || target.email,
    targetRole: target.role || "advisor",
    targetGroupId: target.group_id || null,
    targetAllowedUserId: target.allowedUserId || null,
    startedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (_) {}
  // Wyczyść cache Layout (żeby gate się przeładował z rolą docelową, gdzie relevantne)
  try {
    sessionStorage.removeItem("layout_user_cache");
  } catch (_) {}
  notify();
}

export function clearImpersonation() {
  try {
    localStorage.removeItem(KEY);
  } catch (_) {}
  try {
    sessionStorage.removeItem("layout_user_cache");
  } catch (_) {}
  notify();
}