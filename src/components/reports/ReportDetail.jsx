import React from "react";
import { ArrowLeft, Trash2, Clock, CheckCircle2, Send, User, MapPin, Phone, Calendar, Zap, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import ProductionChart from "../charts/ProductionChart";
import AutoconsumptionPieChart from "../charts/AutoconsumptionPieChart";

const statusConfig = {
  draft: { label: "Szkic", icon: Clock, color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
  completed: { label: "Ukończony", icon: CheckCircle2, color: "bg-green-500/20 text-green-400 border-green-500/30" },
  sent: { label: "Wysłany", icon: Send, color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
};

const statuses = ["draft", "completed", "sent"];

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-sm text-gray-200">{typeof value === "object" ? value.join(", ") : value}</div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  const hasContent = React.Children.toArray(children).some(Boolean);
  if (!hasContent) return null;
  return (
    <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-5 space-y-1">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function CheckItem({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
      <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-sm text-gray-200">{value}</div>
      </div>
    </div>
  );
}

export default function ReportDetail({ report, onBack, onDelete, onStatusChange }) {
  const st = statusConfig[report.status || "draft"];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Wróć</span>
        </button>
        <Button
          onClick={onDelete}
          variant="ghost"
          size="sm"
          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
        >
          <Trash2 className="w-4 h-4 mr-1" /> Usuń
        </Button>
      </div>

      {/* Title card */}
      <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-white">{report.client_name || "Raport"}</h2>
          <Badge variant="outline" className={`border ${st.color}`}>{st.label}</Badge>
        </div>

        {/* Status buttons */}
        <div className="flex gap-2 flex-wrap">
          {statuses.map((s) => {
            const cfg = statusConfig[s];
            const isActive = (report.status || "draft") === s;
            return (
              <button
                key={s}
                onClick={() => onStatusChange(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  isActive ? cfg.color : "border-white/10 text-gray-500 hover:border-white/20"
                }`}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Client info */}
      <Section title="Dane klienta">
        <InfoRow icon={User} label="Klient" value={report.client_name} />
        <InfoRow icon={MapPin} label="Adres" value={report.client_address} />
        <InfoRow icon={Phone} label="Telefon" value={report.client_phone} />
        <InfoRow icon={Calendar} label="Data wizyty" value={report.visit_date ? new Date(report.visit_date).toLocaleDateString("pl-PL") : null} />
        <InfoRow icon={Zap} label="Rodzaj instalacji" value={report.installation_types} />
      </Section>

      {/* Installation data */}
      <Section title="Dane instalacji">
        <InfoRow icon={Calendar} label="Data uruchomienia" value={report.launch_date} />
        <InfoRow icon={Wrench} label="Wykonawca" value={report.contractor} />
        <InfoRow icon={Zap} label="Roczna produkcja" value={report.annual_production_kwh ? `${report.annual_production_kwh} kWh` : null} />
        <InfoRow icon={Zap} label="Energia pobrana (1.8.0)" value={report.energy_imported_kwh ? `${report.energy_imported_kwh} kWh` : null} />
        <InfoRow icon={Zap} label="Energia oddana (2.8.0)" value={report.energy_exported_kwh ? `${report.energy_exported_kwh} kWh` : null} />
      </Section>

      {/* Charts */}
      {report.annual_production_kwh && report.energy_exported_kwh && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ProductionChart
            production={report.annual_production_kwh}
            exported={report.energy_exported_kwh}
            imported={report.energy_imported_kwh}
          />
          <AutoconsumptionPieChart
            production={report.annual_production_kwh}
            exported={report.energy_exported_kwh}
          />
        </div>
      )}

      {/* Technical check */}
      <Section title="Kontrola techniczna">
        <CheckItem label="Ocena autokonsumpcji" value={report.autoconsumption_rating} />
        <CheckItem label="Stan paneli" value={report.panels_condition} />
        <CheckItem label="Mocowania" value={report.mounting_condition} />
        <CheckItem label="Przewody DC/AC" value={report.cables_condition} />
        <CheckItem label="Zabezpieczenia" value={report.protection_condition} />
        <CheckItem label="Odczyt falownika" value={report.inverter_reading} />
        <CheckItem label="Uziemienie" value={report.grounding_condition} />
        <CheckItem label="Możliwości rozbudowy" value={report.expansion_possibilities} />
        <CheckItem label="Potencjał modernizacji" value={report.modernization_potential} />
        <CheckItem label="Rekomendacje" value={report.recommendations} />
        <CheckItem label="Dodatkowe uwagi" value={report.additional_notes} />
      </Section>

      {/* Interview data */}
      <Section title="Wywiad z klientem">
        <CheckItem label="Roczny koszt energii" value={report.interview_annual_cost} />
        <CheckItem label="Liczba mieszkańców" value={report.interview_residents} />
        <CheckItem label="Największe zużycie" value={report.interview_peak_usage} />
        <CheckItem label="Ogrzewanie wody" value={report.interview_water_heating} />
        <CheckItem label="Sprzęt elektryczny" value={report.interview_equipment} />
        <CheckItem label="Plany zakupowe" value={report.interview_purchase_plans} />
      </Section>

      {report.client_signature && (
        <Section title="Podpis">
          <div className="text-sm text-gray-200 italic">{report.client_signature}</div>
        </Section>
      )}
    </motion.div>
  );
}