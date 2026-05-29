import React from "react";
import { Button } from "@/components/ui/button";

export default function GroupAccessManager({
  title,
  description,
  groups,
  selectedGroupIds,
  onToggleGroup,
  onSave,
  saving,
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
        <Button onClick={onSave} disabled={saving} className="bg-green-600 hover:bg-green-700">
          {saving ? "Zapisywanie..." : "Zapisz dostęp grup"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {groups.map((group) => {
          const id = group.id;
          const name = group.data?.name || group.name;
          const active = selectedGroupIds.includes(id);

          return (
            <button
              key={id}
              onClick={() => onToggleGroup(id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
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