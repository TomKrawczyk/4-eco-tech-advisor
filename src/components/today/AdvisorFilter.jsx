import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Filtr handlowca — widoczny tylko dla administratora
export default function AdvisorFilter({ people, value, onChange }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-11">
        <SelectValue placeholder="Wszyscy handlowcy" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Wszyscy handlowcy ({people.length})</SelectItem>
        {people.map(p => (
          <SelectItem key={p.email} value={p.email}>
            <div className="flex flex-col text-left">
              <span>{p.name || p.email}</span>
              <span className="text-[10px] text-gray-400">{p.email}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}