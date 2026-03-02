import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SheetMappingPanel({ sheetTabs, groups, onClose }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: mappings = [] } = useQuery({
    queryKey: ["sheetMappings"],
    queryFn: () => base44.entities.SheetGroupMapping.list(),
  });

  const saveMutation = useMutation({
    mutationFn: async ({ sheetName, groupId, groupName }) => {
      const existing = mappings.find(m => m.sheet_name === sheetName);
      if (existing) {
        if (!groupId) {
          await base44.entities.SheetGroupMapping.delete(existing.id);
        } else {
          await base44.entities.SheetGroupMapping.update(existing.id, { sheet_name: sheetName, group_id: groupId, group_name: groupName });
        }
      } else if (groupId) {
        await base44.entities.SheetGroupMapping.create({ sheet_name: sheetName, group_id: groupId, group_name: groupName });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sheetMappings"] }),
  });

  const getMapping = (sheetName) => mappings.find(m => m.sheet_name === sheetName);

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="gap-2 h-11" onClick={() => setOpen(true)}>
        <Settings2 className="w-4 h-4" />
        Przypisz arkusze do grup
      </Button>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 w-full">
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold text-sm text-gray-800">Przypisanie zakładek do grup</span>
        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-2">
        {sheetTabs.map(tab => {
          const mapping = getMapping(tab);
          return (
            <div key={tab} className="flex items-center gap-3">
              <span className="text-sm text-gray-700 w-40 shrink-0 truncate">{tab}</span>
              <Select
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
                  <SelectValue placeholder="Brak przypisania" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— brak przypisania —</SelectItem>
                  {groups.map(g => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.data?.name || g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {mapping?.group_name && (
                <Badge className="bg-green-50 text-green-700 border-green-200 text-[10px] shrink-0">
                  {mapping.group_name}
                </Badge>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}