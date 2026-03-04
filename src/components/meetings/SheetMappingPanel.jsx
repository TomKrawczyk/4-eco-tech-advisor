import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Eye, EyeOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export default function SheetMappingPanel({ sheetTabs, groups, onClose }) {
  const queryClient = useQueryClient();

  const { data: mappings = [] } = useQuery({
    queryKey: ["sheetMappings"],
    queryFn: () => base44.entities.SheetGroupMapping.list(),
  });

  const saveMutation = useMutation({
    mutationFn: async ({ sheetName, groupId, groupName, is_active }) => {
      const existing = mappings.find(m => m.sheet_name === sheetName);
      if (existing) {
        await base44.entities.SheetGroupMapping.update(existing.id, {
          sheet_name: sheetName,
          group_id: groupId ?? existing.group_id ?? "",
          group_name: groupName ?? existing.group_name ?? "",
          is_active: is_active ?? existing.is_active ?? true,
        });
      } else {
        await base44.entities.SheetGroupMapping.create({
          sheet_name: sheetName,
          group_id: groupId || "",
          group_name: groupName || "",
          is_active: is_active ?? true,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sheetMappings"] });
      queryClient.invalidateQueries({ queryKey: ["sheetMeetings"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const getMapping = (sheetName) => mappings.find(m => m.sheet_name === sheetName);

  const activeCount = sheetTabs.filter(tab => {
    const m = getMapping(tab);
    return m ? m.is_active !== false : true; // domyślnie aktywny
  }).length;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 w-full">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="font-semibold text-sm text-gray-800">Zarządzanie zakładkami arkusza</span>
          <span className="ml-2 text-xs text-gray-400">Aktywne: {activeCount}/{sheetTabs.length}</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        {sheetTabs.map(tab => {
          const mapping = getMapping(tab);
          const isActive = mapping ? mapping.is_active !== false : true;

          return (
            <div key={tab} className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${isActive ? "bg-white" : "bg-gray-50 opacity-60"}`}>
              {/* Toggle aktywności */}
              <Switch
                checked={isActive}
                onCheckedChange={(checked) => {
                  saveMutation.mutate({ sheetName: tab, is_active: checked });
                  toast.success(checked ? `Arkusz "${tab}" włączony` : `Arkusz "${tab}" wyłączony`);
                }}
              />

              <span className={`text-sm w-40 shrink-0 truncate ${isActive ? "text-gray-700" : "text-gray-400 line-through"}`}>
                {tab}
              </span>

              {/* Przypisanie do grupy */}
              <Select
                disabled={!isActive}
                value={mapping?.group_id || "none"}
                onValueChange={(val) => {
                  const group = groups.find(g => g.id === val);
                  saveMutation.mutate({
                    sheetName: tab,
                    groupId: val === "none" ? "" : val,
                    groupName: group?.data?.name || group?.name || "",
                  });
                }}
              >
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder="Brak grupy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— brak grupy —</SelectItem>
                  {groups.map(g => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.data?.name || g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {mapping?.group_name && isActive && (
                <Badge className="bg-green-50 text-green-700 border-green-200 text-[10px] shrink-0">
                  {mapping.group_name}
                </Badge>
              )}

              {!isActive && (
                <Badge className="bg-gray-100 text-gray-400 border-gray-200 text-[10px] shrink-0">
                  wyłączony
                </Badge>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] text-gray-400">
        Wyłączone arkusze nie będą pobierane. Zmiany są widoczne po odświeżeniu listy spotkań.
      </p>
    </div>
  );
}