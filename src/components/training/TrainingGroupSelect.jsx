import React from "react";
import { Label } from "@/components/ui/label";

export default function TrainingGroupSelect({ groups, selectedGroupIds, onToggle }) {
  return (
    <div>
      <Label className="mb-2 block">Dostęp dla grup</Label>
      <p className="text-xs text-gray-500 mb-2">Brak zaznaczenia = szkolenie widoczne dla wszystkich</p>
      <div className="flex flex-wrap gap-2">
        {groups.map((group) => {
          const name = group.data?.name || group.name;
          const active = selectedGroupIds.includes(group.id);
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => onToggle(group.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                active
                  ? "bg-green-600 text-white border-green-600"
                  : "bg-white text-gray-700 border-gray-300 hover:border-green-300"
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}