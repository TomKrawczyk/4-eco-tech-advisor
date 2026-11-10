export const ROLE_LABELS = {
  advisor: "Doradca",
  team_leader: "Team Leader",
  group_leader: "Lider grupy",
  structure_director: "Dyrektor struktury",
  hr_admin: "Administrator HR",
  admin: "Administrator",
  test_user: "Użytkownik testowy",
  serviceman: "Serwisant",
  auditor: "Audytor",
};

export function roleLabel(role) {
  return ROLE_LABELS[role] || role || "Doradca";
}