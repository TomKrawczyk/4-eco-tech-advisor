import React from "react";
import { Badge } from "@/components/ui/badge";

const roleMap = {
  advisor: { label: "Doradca", className: "border-sky-200 bg-sky-100 text-sky-700" },
  group_leader: { label: "Group Lider", className: "border-violet-200 bg-violet-100 text-violet-700" },
  team_leader: { label: "Team Lider", className: "border-amber-200 bg-amber-100 text-amber-700" },
};

export default function WeeklyRoleBadge({ role }) {
  const config = roleMap[role] || { label: role || "Brak roli", className: "border-gray-200 bg-gray-100 text-gray-700" };
  return <Badge className={config.className}>{config.label}</Badge>;
}