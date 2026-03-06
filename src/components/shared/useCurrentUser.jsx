import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

/**
 * Hook pobierający aktualnego zalogowanego użytkownika z jego rolą i groupId.
 * groupId jest pobierane z AllowedUser.group_id,
 * a jeśli brak — szuka w Group.group_leader_ids jako fallback.
 */
export default function useCurrentUser() {
  const [currentUser, setCurrentUser] = useState(null);
  const [accessChecked, setAccessChecked] = useState(false);

  const fetchUser = async () => {
    const user = await base44.auth.me();
    const [allowedUsers, groups] = await Promise.all([
      base44.entities.AllowedUser.list(),
      base44.entities.Group.list(),
    ]);
    const ua = allowedUsers.find(a => (a.data?.email || a.email) === user.email);
    if (ua) {
      user.role = ua.data?.role || ua.role;
      user.displayName = ua.data?.name || ua.name;
      let groupId = ua.data?.group_id || ua.group_id;
      if (!groupId) {
        // Szukaj w group_leader_ids po id, email lub nazwisku – dla każdej roli
        const myGroup = groups.find(g => {
          const ids = g.data?.group_leader_ids || g.group_leader_ids || [];
          const legacyId = g.data?.group_leader_id || g.group_leader_id;
          const uaEmail = ua.data?.email || ua.email;
          const uaName = ua.data?.name || ua.name;
          return (
            ids.includes(ua.id) ||
            ids.includes(uaEmail) ||
            ids.includes(uaName) ||
            legacyId === ua.id ||
            legacyId === uaEmail
          );
        });
        groupId = myGroup?.id || null;
      }
      console.log(`[useCurrentUser] ${user.email} role=${user.role} groupId=${groupId} ua.id=${ua.id}`);
      user.groupId = groupId;
      user.allowedUserId = ua.id;
    }
    setCurrentUser(user);
    setAccessChecked(true);
  };

  useEffect(() => {
    fetchUser();
    // Odśwież co 2 minuty — żeby awanse ról były widoczne bez wylogowania
    const interval = setInterval(fetchUser, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return { currentUser, accessChecked };
}