import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

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
    const legacyBlocked = (ua.data?.is_blocked || ua.is_blocked) === true;
    user.account_status = user.account_status === "blocked" || legacyBlocked ? "blocked" : "active";
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
  return user;
}

/**
 * Hook pobierający aktualnego użytkownika z rolą i groupId.
 * Używa React Query – dane są cache'owane i współdzielone między komponentami.
 * Odświeżenie następuje co 5 minut (staleTime), nie przy każdym mount.
 */
export default function useCurrentUser() {
  const { data: currentUser = null, isFetching, isSuccess } = useQuery({
    queryKey: ["currentUser"],
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  return { currentUser, accessChecked: isSuccess || (!isFetching && currentUser !== null) };
}