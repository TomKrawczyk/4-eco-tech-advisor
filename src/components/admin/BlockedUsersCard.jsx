import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Unlock } from "lucide-react";

export default function BlockedUsersCard() {
  const queryClient = useQueryClient();
  const { data: users = [] } = useQuery({ queryKey: ["blockedUserAccounts"], queryFn: () => base44.entities.User.list("-updated_date", 500) });
  const { data: allowedUsers = [] } = useQuery({ queryKey: ["blockedAllowedUsers"], queryFn: () => base44.entities.AllowedUser.list() });
  const blockedUsers = React.useMemo(() => users.filter(user => user.account_status === "blocked").map(user => ({ ...user, display_name: allowedUsers.find(a => (a.data?.email || a.email) === user.email)?.data?.name || user.full_name || user.email })).sort((a, b) => String(a.blocked_at || "").localeCompare(String(b.blocked_at || ""))), [users, allowedUsers]);
  const unblockMutation = useMutation({ mutationFn: async (user) => { const allowed = allowedUsers.find(a => (a.data?.email || a.email) === user.email); await base44.entities.User.update(user.id, { account_status: "active", blocked_reason: "", blocked_at: "" }); if (allowed) await base44.entities.AllowedUser.update(allowed.id, { is_blocked: false, blocked_reason: "", missing_reports_count: 0 }); }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["blockedUserAccounts"] }); queryClient.invalidateQueries({ queryKey: ["blockedAllowedUsers"] }); queryClient.invalidateQueries({ queryKey: ["allowedUsers"] }); } });
  if (blockedUsers.length === 0) return null;
  return <Card className="border-red-200 shadow-md mb-8"><CardContent className="p-6"><div className="flex items-center gap-2 mb-4"><Lock className="w-5 h-5 text-red-600" /><h3 className="text-lg font-bold text-gray-900">Aktualnie zablokowani</h3></div><div className="space-y-3">{blockedUsers.map(user => <div key={user.id} className="flex items-start justify-between gap-3 rounded-xl border border-red-100 bg-red-50/60 p-4"><div><div className="font-semibold text-gray-900 text-sm">{user.display_name}</div><div className="text-xs text-gray-500">{user.email}</div><div className="text-sm text-red-700 mt-1">{user.blocked_reason || "Brak raportowania"}</div><div className="text-xs text-gray-500 mt-1">Od: {user.blocked_at ? new Date(user.blocked_at).toLocaleString("pl-PL") : "—"}</div></div><Button size="sm" variant="outline" className="border-green-200 text-green-700 hover:bg-green-50" onClick={() => unblockMutation.mutate(user)} disabled={unblockMutation.isPending}><Unlock className="w-4 h-4 mr-1" />Odblokuj</Button></div>)}</div></CardContent></Card>;
}