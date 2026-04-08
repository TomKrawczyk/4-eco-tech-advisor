import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Crown,
  Users,
  User,
  Briefcase,
  Eye,
  AlertCircle,
  Lock,
} from "lucide-react";

const roleStyles = {
  admin: {
    label: "Administrator",
    color: "bg-purple-100 text-purple-700 border-purple-200",
    icon: Shield,
  },
  group_leader: {
    label: "Lider grupy",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    icon: Crown,
  },
  team_leader: {
    label: "Team Leader",
    color: "bg-green-100 text-green-700 border-green-200",
    icon: Users,
  },
  hr_admin: {
    label: "Administrator HR",
    color: "bg-orange-100 text-orange-700 border-orange-200",
    icon: Briefcase,
  },
  serviceman: {
    label: "Serwisant",
    color: "bg-indigo-100 text-indigo-700 border-indigo-200",
    icon: Briefcase,
  },
  auditor: {
    label: "Audytor",
    color: "bg-cyan-100 text-cyan-700 border-cyan-200",
    icon: Eye,
  },
  test_user: {
    label: "Użytkownik testowy",
    color: "bg-yellow-100 text-yellow-700 border-yellow-200",
    icon: AlertCircle,
  },
  advisor: {
    label: "Doradca",
    color: "bg-teal-100 text-teal-700 border-teal-200",
    icon: User,
  },
};

export function RoleBadge({ user, size = "sm", variant = "default" }) {
  const role = user?.data?.role || user?.role || "advisor";
  const config = roleStyles[role] || roleStyles.advisor;
  const Icon = config.icon;

  if (variant === "icon-only") {
    return (
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${config.color}`}
        title={config.label}
      >
        <Icon className="w-4 h-4" />
      </div>
    );
  }

  return (
    <Badge className={`text-[10px] border ${config.color} flex items-center gap-1`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
}

export function StatusBadge({ user }) {
  const isBlocked = user?.data?.is_blocked || user?.is_blocked;

  if (isBlocked) {
    return (
      <Badge className="text-[10px] border bg-red-100 text-red-700 border-red-200 flex items-center gap-1">
        <Lock className="w-3 h-3" />
        Konto zablokowane
      </Badge>
    );
  }

  return null;
}