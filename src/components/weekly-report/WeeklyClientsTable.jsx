import React from "react";
import { Badge } from "@/components/ui/badge";

function getStatusConfig(client) {
  if (!client.reported) return { label: "BRAK RAPORTU", className: "border-red-200 bg-red-100 text-red-700" };
  if (client.report_status === "completed") return { label: "Zrealizowane", className: "border-green-200 bg-green-100 text-green-700" };
  if (client.report_status === "planned") return { label: "Przełożone", className: "border-amber-200 bg-amber-100 text-amber-700" };
  return { label: "Zaraportowane", className: "border-green-200 bg-green-100 text-green-700" };
}

export default function WeeklyClientsTable({ clients }) {
  const missingCount = clients.filter((client) => !client.reported).length;

  return (
    <section>
      <h3 className="mb-3 text-base font-semibold text-slate-800">Klienci do obdzwonienia</h3>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-slate-800">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-left font-semibold">Klient</th>
              <th className="px-4 py-3 text-left font-semibold">Telefon</th>
              <th className="px-4 py-3 text-left font-semibold">Data/godz</th>
              <th className="px-4 py-3 text-left font-semibold">Doradca</th>
              <th className="px-4 py-3 text-left font-semibold">Adres</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client, index) => {
              const status = getStatusConfig(client);
              return (
                <tr key={`${client.client_name}-${client.client_phone}-${index}`} className={client.reported ? "border-t border-gray-200 hover:bg-gray-50" : "border-t border-gray-200 bg-red-50 hover:bg-red-50"}>
                  <td className="px-4 py-3"><Badge className={status.className}>{status.label}</Badge></td>
                  <td className="px-4 py-3 font-medium text-slate-800">{client.client_name || "—"}</td>
                  <td className="px-4 py-3">
                    {client.client_phone ? (
                      <a href={`tel:${client.client_phone}`} className="font-medium text-green-600 underline-offset-4 hover:text-green-700 hover:underline">{client.client_phone}</a>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{client.meeting_calendar || "—"}</td>
                  <td className="px-4 py-3 text-slate-700">{client.advisor_name || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{client.client_address || "—"}</td>
                </tr>
              );
            })}
            {clients.length === 0 && (
              <tr>
                <td colSpan="6" className="px-4 py-6 text-center text-gray-500">Brak klientów w tym zakresie.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-gray-500">{clients.length} klientów, {missingCount} bez raportu (do obdzwonienia)</p>
    </section>
  );
}