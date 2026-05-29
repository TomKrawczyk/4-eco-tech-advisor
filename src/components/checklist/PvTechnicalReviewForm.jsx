import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { pvTechnicalReviewSections } from "@/components/checklist/pvTechnicalReviewConfig";

export default function PvTechnicalReviewForm({
  form,
  onChange,
  availableGroups,
  selectedGroupIds,
  onToggleGroup,
  isAdmin,
}) {
  return (
    <div className="space-y-6">
      {isAdmin && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Dostęp do formularza</h3>
            <p className="text-sm text-gray-500 mt-1">Wybierz grupy, które mogą korzystać z tego przeglądu.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {availableGroups.map((group) => {
              const groupName = group.data?.name || group.name;
              const active = selectedGroupIds.includes(group.id);
              return (
                <Button
                  key={group.id}
                  type="button"
                  variant={active ? "default" : "outline"}
                  className={active ? "bg-green-600 hover:bg-green-700" : ""}
                  onClick={() => onToggleGroup(group.id)}
                >
                  {groupName}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {pvTechnicalReviewSections.map((section) => (
        <div key={section.title} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="text-base font-semibold text-gray-900">{section.title}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {section.fields.map((field) => (
              <div key={field.key} className={field.key === "support_installation_cost" ? "md:col-span-2" : ""}>
                <Label className="text-gray-700 text-xs mb-1">{field.label}</Label>
                <Input
                  value={form[field.key] || ""}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}