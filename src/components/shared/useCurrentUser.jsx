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

  useEffect(() => {
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
        if (!groupId && (user.role === "group_leader" || user.role === "team_leader")) {
          const myGroup = groups.find(g => {
            const ids = g.data?.group_leader_ids || g.group_leader_ids || [];
            return ids.includes(ua.id);
          });
          groupId = myGroup?.id || null;
        }
        user.groupId = groupId;
      }
      setCurrentUser(user);
      setAccessChecked(true);
    };
    fetchUser();
  }, []);

  return { currentUser, accessChecked };
}