import React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

export default function AllReportsFilters({ search, setSearch, typeFilter, setTypeFilter, personFilter, setPersonFilter, people }) {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <div className="relative flex-1 min-w-[220px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Szukaj klienta, telefonu, adresu, opisu..."
          className="pl-9 h-11"
        />
      </div>

      <Select value={typeFilter} onValueChange={setTypeFilter}>
        <SelectTrigger className="w-48 h-11">
          <SelectValue placeholder="Typ raportu" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Wszystkie raporty</SelectItem>
          <SelectItem value="phone">Kontakty telefoniczne</SelectItem>
          <SelectItem value="meeting">Spotkania</SelectItem>
          <SelectItem value="visit">Wizyty</SelectItem>
          <SelectItem value="service">Serwis</SelectItem>
        </SelectContent>
      </Select>

      <Select value={personFilter} onValueChange={setPersonFilter}>
        <SelectTrigger className="w-56 h-11">
          <SelectValue placeholder="Przypisana osoba" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Wszyscy handlowcy</SelectItem>
          {people.map(person => (
            <SelectItem key={person.email} value={person.email}>{person.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}