import React from "react";
import { Phone, Building2 } from "lucide-react";
import { bankingContacts } from "./financingData";

export default function BankContactsTab() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {bankingContacts.map((group) => (
        <div key={group.bank} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-green-50 text-green-700 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{group.bank}</h3>
          </div>
          <div className="space-y-3">
            {group.people.map((person) => (
              <div key={`${group.bank}-${person.name}`} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <div className="text-sm font-semibold text-gray-900">{person.name}</div>
                <div className="text-xs text-gray-500 mb-2">{person.role}</div>
                <a href={`tel:${person.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-2 text-sm text-green-700 font-medium hover:underline">
                  <Phone className="w-4 h-4" /> {person.phone}
                </a>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}