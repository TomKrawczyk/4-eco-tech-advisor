import React from "react";
import { Badge } from "@/components/ui/badge";

function getStatusConfig(contact) {
  if (!contact.reported) return { label: "BRAK RAPORTU", className: "border-red-200 bg-red-100 text-red-700" };
  return { label: "Zaraportowano", className: "border-green-200 bg-green-100 text-green-700" };
}

export default function WeeklyPhoneContactsTable({ contacts }) {
  const missingCount = contacts.filter((contact) => !contact.reported).length;

  if (contacts.length === 0) {
    return <p className="text-sm text-gray-500">Brak przypisanych kontaktów telefonicznych.</p>;
  }

  return (
    <section>
      <h3 className="mb-3 text-base font-semibold text-slate-800">Kontakty telefoniczne</h3>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-slate-800">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-left font-semibold">Klient</th>
              <th className="px-4 py-3 text-left font-semibold">Telefon</th>
              <th className="px-4 py-3 text-left font-semibold">Data</th>
              <th className="px-4 py-3 text-left font-semibold">Doradca</th>
              <th className="px-4 py-3 text-left font-semibold">Adres</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact, index) => {
              const status = getStatusConfig(contact);
              return (
                <tr key={`${contact.client_name}-${contact.client_phone}-${index}`} className={contact.reported ? "border-t border-gray-200 hover:bg-gray-50" : "border-t border-gray-200 bg-red-50 hover:bg-red-50"}>
                  <td className="px-4 py-3"><Badge className={status.className}>{status.label}</Badge></td>
                  <td className="px-4 py-3 font-medium text-slate-800">{contact.client_name || "—"}</td>
                  <td className="px-4 py-3">
                    {contact.client_phone ? (
                      <a href={`tel:${contact.client_phone}`} className="font-medium text-green-600 underline-offset-4 hover:text-green-700 hover:underline">{contact.client_phone}</a>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{contact.contact_calendar || contact.contact_date || "—"}</td>
                  <td className="px-4 py-3 text-slate-700">{contact.advisor_name || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{contact.client_address || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-gray-500">{contacts.length} kontaktów, {missingCount} bez raportu</p>
    </section>
  );
}