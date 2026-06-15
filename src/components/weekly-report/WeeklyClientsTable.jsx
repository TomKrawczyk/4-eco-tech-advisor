import React from "react";
import { Badge } from "@/components/ui/badge";

function getStatusConfig(client) {
  if (!client.reported) return { label: "BRAK RAPORTU", className: "border-red-500/30 bg-red-500/15 text-red-200" };
  if (client.report_status === "completed") return { label: "Zrealizowane", className: "border-emerald-500/30 bg-emerald-500/15 text-emerald-200" };
  if (client.report_status === "planned") return { label: "Przełożone", className: "border-emerald-500/30 bg-emerald-500/15 text-emerald-200" };
  return { label: "Zaraportowane", className: "border-emerald-500/30 bg-emerald-500/15 text-emerald-200" };
}

export default function WeeklyClientsTable({ clients }) {
  const missingCount = clients.filter((client) => !client.reported).length;

  return (
    <section>
      <h3 className="mb-3 text-base font-semibold text-white">Klienci do obdzwonienia</h3>
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/70">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-900 text-slate-300">
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
                <tr key={`${client.client_name}-${client.client_phone}-${index}`} className={client.reported ? "border-t border-slate-800" : "border-t border-red-900/40 bg-red-500/10"}>
                  <td className="px-4 py-3"><Badge className={status.className}>{status.label}</Badge></td>
                  <td className="px-4 py-3 font-medium text-slate-100">{client.client_name || "—"}</td>
                  <td className="px-4 py-3">
                    {client.client_phone ? (
                      <a href={`tel:${client.client_phone}`} className="font-medium text-emerald-300 underline-offset-4 hover:underline">{client.client_phone}</a>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{client.meeting_calendar || "—"}</td>
                  <td className="px-4 py-3 text-slate-300">{client.advisor_name || "—"}</td>
                  <td className="px-4 py-3 text-slate-400">{client.client_address || "—"}</td>
                </tr>
              );
            })}
            {clients.length === 0 && (
              <tr>
                <td colSpan="6" className="px-4 py-6 text-center text-slate-500">Brak klientów w tym zakresie.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-slate-400">{clients.length} klientów, {missingCount} bez raportu (do obdzwonienia)</p>
    </section>
  );
}