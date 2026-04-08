import { Lock } from "lucide-react";

export default function StatusBadge({ user }) {
  const isBlocked = user.data?.is_blocked || user.is_blocked;

  if (!isBlocked) return null;

  return (
    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">
      <Lock className="w-3 h-3" />
      Zablokowany
    </div>
  );
}