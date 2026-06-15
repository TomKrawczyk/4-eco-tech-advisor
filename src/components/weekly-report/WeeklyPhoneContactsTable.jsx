import React from "react";
import { Badge } from "@/components/ui/badge";

function getStatusConfig(contact) {
  if (!contact?.reported) {
    return { label: "BRAK RAPORTU", className: "border-red-200 bg-red-100 text-red-700" };
  }
  return { label: "Zaraportowano", className: "border-green-200 bg-green-100 text-green-700" };
}

function ContactCard({ contact }) {
  const status = getStatusConfig(contact);

  return (
    <div className={`rounded-xl border p-4 shadow-sm ${contact?.reported ? "border-gray-200 bg-white" : "border-red-200 bg-[#FFF1F1]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-slate-800">{contact?.client_name || "—"}</div>
          <div className="mt-1 text-sm text-gray-500">{contact?.contact_date || "—"}</div>
        </div>
        <Badge className={status.className}>{status.label}</Badge>
      </div>
      {contact?.report_status && contact?.reported && (
        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-green-700">{contact.report_status}</p>
      )}
      <div className="mt-4 space-y-3 text-sm">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Telefon</div>
          {contact?.client_phone ? (
            <a href={`tel:${contact.client_phone}`} className="font-medium text-green-600 underline-offset-4 hover:text-green-700 hover:underline">{contact.client_phone}</a>
          ) : (
            <span className="text-gray-500">—</span>
          )}
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Doradca</div>
          <div className="text-slate-700">{contact?.advisor_name || "— nieprzypisany —"}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Adres</div>
          <div className="text-slate-700">{contact?.client_address || "—"}</div>
        </div>
      </div>
    </div>
  );
}

export default function WeeklyPhoneContactsTable({ contacts, metrics }) {
  const safeContacts = Array.isArray(contacts) ? contacts : [];
  const assignedCount = metrics?.phone_contacts_assigned ?? 0;
  const missingCount = metrics?.phone_contacts_missing ?? 0;

  return (
    <section>
      <h3 className="mb-3 text-base font-semibold text-slate-800">Kontakty telefoniczne — {missingCount} z {assignedCount} bez raportu</h3>

      {safeContacts.length === 0 ? (
        <p className="text-sm text-gray-500">Brak przypisanych kontaktów telefonicznych w tym tygodniu.</p>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {safeContacts.map((contact, index) => (
              <ContactCard key={`${contact?.client_name || "kontakt"}-${contact?.client_phone || index}-${index}`} contact={contact} />
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-slate-800">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Klient</th>
                  <th className="px-4 py-3 text-left font-semibold">Telefon</th>
                  <th className="px-4 py-3 text-left font-semibold">Data</th>
                  <th className="px-4 py-3 text-left font-semibold">Doradca</th>
                  <th className="px-4 py-3 text-left font-semibold">Adres</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {safeContacts.map((contact, index) => {
                  const status = getStatusConfig(contact);
                  return (
                    <tr key={`${contact?.client_name || "kontakt"}-${contact?.client_phone || index}-${index}`} className={contact?.reported ? "border-t border-gray-200 hover:bg-gray-50" : "border-t border-red-100 bg-[#FFF1F1] hover:bg-[#FFF1F1]"}>
                      <td className="px-4 py-3 font-medium text-slate-800">{contact?.client_name || "—"}</td>
                      <td className="px-4 py-3">
                        {contact?.client_phone ? (
                          <a href={`tel:${contact.client_phone}`} className="font-medium text-green-600 underline-offset-4 hover:text-green-700 hover:underline">{contact.client_phone}</a>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{contact?.contact_date || "—"}</td>
                      <td className="px-4 py-3 text-slate-700">{contact?.advisor_name || "— nieprzypisany —"}</td>
                      <td className="px-4 py-3 text-gray-500">{contact?.client_address || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <Badge className={status.className}>{status.label}</Badge>
                          {contact?.report_status && contact?.reported && (
                            <span className="text-xs font-medium text-green-700">{contact.report_status}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}