import React from "react";
import { Badge } from "@/components/ui/badge";

const roleMap = {
  advisor: { label: "Doradca", className: "border-sky-400/30 bg-sky-500/15 text-sky-200" },
  group_leader: { label: "Group Lider", className: "border-violet-400/30 bg-violet-500/15 text-violet-200" },
  team_leader: { label: "Team Lider", className: "border-amber-400/30 bg-amber-500/15 text-amber-200" },
};

export default function WeeklyRoleBadge({ role }) {
  const config = roleMap[role] || { label: role || "Brak roli", className: "border-slate-600 bg-slate-800 text-slate-200" };
  return <Badge className={config.className}>{config.label}</Badge>;
}