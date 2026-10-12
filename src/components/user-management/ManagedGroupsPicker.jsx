import React from "react";
import { Label } from "@/components/ui/label";

// Wybór grup zarządzanych przez dyrektora struktury (checkboxy)
export default function ManagedGroupsPicker({ groups = [], value = [], onChange }) {
  if (groups.length === 0) return null;

  const toggle = (groupId, checked) => {
    onChange(checked ? [...value, groupId] : value.filter(id => id !== groupId));
  };

  return (
    <div>
      <Label className="text-sm">Zarządzane grupy</Label>
      <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-md p-2 space-y-1">
        {groups.map(group => (
          <label key={group.id} className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={value.includes(group.id)}
              onChange={(e) => toggle(group.id, e.target.checked)}
            />
            {group.data?.name || group.name}
          </label>
        ))}
      </div>
      <p className="text-[11px] text-gray-400 mt-1">
        Dyrektor widzi handlowców, spotkania i kontakty z wybranych grup. W paczkach przypisanych do niego może przydzielać kontakty każdemu z tych grup.
      </p>
    </div>
  );
}