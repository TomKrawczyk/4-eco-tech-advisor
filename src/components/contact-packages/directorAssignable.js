// Handlowcy, którym dyrektor struktury może przydzielać kontakty:
// wszyscy doradcy, team leaderzy i liderzy z grup, którymi zarządza.
export function getDirectorAssignableUsers(salesUsers, allGroups, managedGroupIds = []) {
  const managed = new Set(managedGroupIds);
  const leaderKeys = new Set();
  allGroups.forEach(g => {
    if (!managed.has(g.id)) return;
    const ids = g.group_leader_ids || g.data?.group_leader_ids || [];
    const legacyId = g.group_leader_id || g.data?.group_leader_id;
    [legacyId, ...ids].filter(Boolean).forEach(id => leaderKeys.add(id));
  });

  return salesUsers.filter(u =>
    ["advisor", "team_leader", "group_leader"].includes(u.role) &&
    ((u.group_id && managed.has(u.group_id)) || leaderKeys.has(u.id) || leaderKeys.has(u.email))
  );
}