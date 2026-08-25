import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { getImpersonation } from "@/lib/impersonation";

async function fetchCurrentUser() {
  const user = await base44.auth.me();
  const [allowedUsers, groups] = await Promise.all([
    base44.entities.AllowedUser.list(),
    base44.entities.Group.list(),
  ]);
  const ua = allowedUsers.find(a => (a.data?.email || a.email) === user.email);
  if (ua) {
    user.role = ua.data?.role || ua.role;
    user.displayName = ua.data?.name || ua.name;
    const blockedUntil = ua.data?.blocked_until || ua.blocked_until || "";
    const adminBlocked = blockedUntil && new Date(blockedUntil) >= new Date(new Date().toISOString().split("T")[0]);
    const legacyBlocked = (ua.data?.is_blocked || ua.is_blocked) === true && (!blockedUntil || adminBlocked);
    user.account_status = user.account_status === "blocked" || legacyBlocked || adminBlocked ? "blocked" : "active";
    user.blocked_until = blockedUntil || null;
    user.blocked_reason = user.blocked_reason || ua.data?.blocked_reason || ua.blocked_reason || "";
    user.blocked_at = user.blocked_at || null;
    user.is_blocked = user.account_status === "blocked";
    let groupId = ua.data?.group_id || ua.group_id;
    if (!groupId) {
      const uaEmail = ua.data?.email || ua.email;
      const myGroup = groups.find(g => {
        const ids = g.data?.group_leader_ids || g.group_leader_ids || [];
        const legacyId = g.data?.group_leader_id || g.group_leader_id;
        return (
          ids.includes(ua.id) ||
          ids.includes(uaEmail) ||
          legacyId === ua.id ||
          legacyId === uaEmail
        );
      });
      groupId = myGroup?.id || null;
    }
    user.groupId = groupId;
    user.allowedUserId = ua.id;
  }

  // --- Impersonacja (admin "Zaloguj jako") ---
  // Nadpisujemy email/rolę/grupę tylko gdy prawdziwy użytkownik to admin.
  // Dzięki temu wszystkie strony filtrujące po currentUser.email widzą dane
  // podglądanego doradcy/lidera, a created_by/RLS pozostają na koncie admina.
  const imp = getImpersonation();
  if (imp && user.role === "admin") {
    user.impersonated_by = imp.adminEmail;
    user.impersonated_by_name = imp.adminName;
    user.is_impersonating = true;
    user.real_email = user.email;
    user.real_name = user.displayName || user.full_name;
    user.real_role = "admin";
    user.email = imp.targetEmail;
    user.full_name = imp.targetName;
    user.displayName = imp.targetName;
    user.role = imp.targetRole;
    user.groupId = imp.targetGroupId || null;
    user.allowedUserId = imp.targetAllowedUserId || null;
    // W trybie podglądu nieblokujemy ekranem blokady/braków doradcy
    user.account_status = "active";
    user.is_blocked = false;
    user.blocked_until = null;
  }
  return user;
}

/**
 * Hook pobierający aktualnego użytkownika z rolą i groupId.
 * Używa React Query – dane są cache'owane i współdzielone między komponentami.
 * Odświeżenie następuje co 5 minut (staleTime), nie przy każdym mount.
 */
export default function useCurrentUser() {
  const queryClient = useQueryClient();
  const { data: currentUser = null, isFetching, isSuccess } = useQuery({
    queryKey: ["currentUser"],
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  // Reaguj na start/stop impersonacji — przeładuj tożsamość natychmiast.
  useEffect(() => {
    const handler = () => queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    window.addEventListener("impersonation-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("impersonation-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, [queryClient]);

  return { currentUser, accessChecked: isSuccess || (!isFetching && currentUser !== null) };
}