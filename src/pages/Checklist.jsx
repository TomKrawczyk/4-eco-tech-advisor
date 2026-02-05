import React, { useState } from "react";
import { ClipboardCheck, Save, RotateCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/shared/PageHeader";

const initialState = {
  client_name: "",
  client_address: "",
  client_phone: "",
  visit_date: new Date().toISOString().split("T")[0],
  installation_types: [],
  launch_date: "",
  contractor: "",
  annual_production_kwh: "",
  energy_imported_kwh: "",
  energy_exported_kwh: "",
  autoconsumption_rating: "",
  panels_condition: "",
  mounting_condition: "",
  cables_condition: "",
  protection_condition: "",
  inverter_reading: "",
  grounding_condition: "",
  expansion_possibilities: "",
  modernization_potential: "",
  recommendations: "",
  additional_notes: "",
  client_signature: "",
};

const checklistItems = [
  { key: "autoconsumption_rating", label: "Ocena autokonsumpcji i bilansu z siecią", placeholder: "np. Autokonsumpcja ok. 35%, eksport 65%" },
  { key: "panels_condition", label: "Wizualna kontrola paneli/modułów (pęknięcia, zabrudzenia)", placeholder: "np. Panele czyste, brak pęknięć" },
  { key: "mounting_condition", label: "Kontrola mocowań i konstrukcji nośnej", placeholder: "np. Mocowania stabilne, brak korozji" },
  { key: "cables_condition", label: "Wizualne sprawdzenie przewodów DC/AC, połączeń MC4", placeholder: "np. Wszystkie MC4 szczelne" },
  { key: "protection_condition", label: "Wizualny stan zabezpieczeń: SPD, RCD, wyłączniki", placeholder: "np. SPD sprawne, RCD testowane – OK" },
  { key: "inverter_reading", label: "Odczyt falownika: błędy, produkcja, komunikacja", placeholder: "np. Brak błędów, komunikacja Wi-Fi OK" },
  { key: "grounding_condition", label: "Wizualna kontrola uziemienia i ciągłości przewodów ochronnych", placeholder: "np. Uziemienie wizualnie OK" },
  { key: "expansion_possibilities", label: "Ocena możliwości rozbudowy: miejsce, przyłącze, ograniczenia", placeholder: "np. Dach pozwala na +6 paneli" },
  { key: "modernization_potential", label: "Wstępna kalkulacja potencjału modernizacji (kWh/rok)", placeholder: "np. +3200 kWh/rok po dodaniu magazynu" },
  { key: "recommendations", label: "Rekomendacje: serwis, czyszczenie, wymiana elementów krytycznych", placeholder: "Zalecane: czyszczenie paneli, przegląd SPD" },
  { key: "additional_notes", label: "Dodatkowa rekomendacja", placeholder: "np. Montaż optymalizatorów" },
];

const installationOptions = ["PV", "Pompa ciepła", "Magazyn energii"];

export default function Checklist() {
  const [form, setForm] = useState(initialState);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [completedItems, setCompletedItems] = useState({});

  const update = (key, value) => setForm({ ...form, [key]: value });

  const toggleInstallation = (type) => {
    const types = form.installation_types.includes(type)
      ? form.installation_types.filter((t) => t !== type)
      : [...form.installation_types, type];
    update("installation_types", types);
  };

  const toggleCompleted = (key) => {
    setCompletedItems({ ...completedItems, [key]: !completedItems[key] });
  };

  const handleSave = async () => {
    if (!form.client_name.trim()) return;
    setSaving(true);
    const data = { ...form };
    if (data.annual_production_kwh) data.annual_production_kwh = parseFloat(data.annual_production_kwh);
    if (data.energy_imported_kwh) data.energy_imported_kwh = parseFloat(data.energy_imported_kwh);
    if (data.energy_exported_kwh) data.energy_exported_kwh = parseFloat(data.energy_exported_kwh);
    await base44.entities.VisitReport.create(data);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    setForm(initialState);
    setCompletedItems({});
  };

  const completedCount = Object.values(completedItems).filter(Boolean).length;
  const totalItems = checklistItems.length;
  const progress = totalItems > 0 ? (completedCount / totalItems) * 100 : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ClipboardCheck}
        title="Checklista Doradcy Technicznego"
        subtitle="Analiza i modernizacja instalacji"
        color="green"
      />

      {/* Progress */}
      <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-400">Postęp kontroli</span>
          <span className="text-sm font-semibold text-green-400">{completedCount}/{totalItems}</span>
        </div>
        <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Client Data */}
      <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-5 space-y-4">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-green-500/20 flex items-center justify-center text-xs text-green-400">1</span>
          Dane klienta
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-gray-400 text-xs mb-1">Imię i nazwisko *</Label>
            <Input
              value={form.client_name}
              onChange={(e) => update("client_name", e.target.value)}
              placeholder="Jan Kowalski"
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-green-500/50"
            />
          </div>
          <div>
            <Label className="text-gray-400 text-xs mb-1">Telefon</Label>
            <Input
              value={form.client_phone}
              onChange={(e) => update("client_phone", e.target.value)}
              placeholder="600 123 456"
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-green-500/50"
            />
          </div>
          <div className="md:col-span-2">
            <Label className="text-gray-400 text-xs mb-1">Adres</Label>
            <Input
              value={form.client_address}
              onChange={(e) => update("client_address", e.target.value)}
              placeholder="ul. Słoneczna 12, 00-000 Warszawa"
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-green-500/50"
            />
          </div>
          <div>
            <Label className="text-gray-400 text-xs mb-1">Data wizyty</Label>
            <Input
              type="date"
              value={form.visit_date}
              onChange={(e) => update("visit_date", e.target.value)}
              className="bg-white/5 border-white/10 text-white focus:border-green-500/50"
            />
          </div>
        </div>

        <div>
          <Label className="text-gray-400 text-xs mb-2 block">Rodzaj instalacji</Label>
          <div className="flex flex-wrap gap-2">
            {installationOptions.map((opt) => (
              <button
                key={opt}
                onClick={() => toggleInstallation(opt)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  form.installation_types.includes(opt)
                    ? "bg-green-500/20 text-green-400 border border-green-500/40"
                    : "bg-white/5 text-gray-400 border border-white/10 hover:border-white/20"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Installation Data */}
      <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-5 space-y-4">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-green-500/20 flex items-center justify-center text-xs text-green-400">2</span>
          Dane instalacji
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-gray-400 text-xs mb-1">Data uruchomienia</Label>
            <Input
              value={form.launch_date}
              onChange={(e) => update("launch_date", e.target.value)}
              placeholder="2023-06-15"
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-green-500/50"
            />
          </div>
          <div>
            <Label className="text-gray-400 text-xs mb-1">Wykonawca</Label>
            <Input
              value={form.contractor}
              onChange={(e) => update("contractor", e.target.value)}
              placeholder="Nazwa firmy"
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-green-500/50"
            />
          </div>
          <div>
            <Label className="text-gray-400 text-xs mb-1">Roczna produkcja [kWh]</Label>
            <Input
              type="number"
              value={form.annual_production_kwh}
              onChange={(e) => update("annual_production_kwh", e.target.value)}
              placeholder="8500"
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-green-500/50"
            />
          </div>
          <div>
            <Label className="text-gray-400 text-xs mb-1">Energia pobrana 1.8.0 [kWh]</Label>
            <Input
              type="number"
              value={form.energy_imported_kwh}
              onChange={(e) => update("energy_imported_kwh", e.target.value)}
              placeholder="3200"
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-green-500/50"
            />
          </div>
          <div>
            <Label className="text-gray-400 text-xs mb-1">Energia oddana 2.8.0 [kWh]</Label>
            <Input
              type="number"
              value={form.energy_exported_kwh}
              onChange={(e) => update("energy_exported_kwh", e.target.value)}
              placeholder="5300"
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-green-500/50"
            />
          </div>
        </div>
      </div>

      {/* Checklist Items */}
      <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-5 space-y-3">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-green-500/20 flex items-center justify-center text-xs text-green-400">3</span>
          Kontrola techniczna
        </h3>
        {checklistItems.map((ci) => (
          <motion.div
            key={ci.key}
            className={`rounded-xl border p-4 transition-all ${
              completedItems[ci.key]
                ? "bg-green-500/5 border-green-500/20"
                : "bg-white/[0.02] border-white/[0.06]"
            }`}
          >
            <div className="flex items-start gap-3">
              <button
                onClick={() => toggleCompleted(ci.key)}
                className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                  completedItems[ci.key]
                    ? "bg-green-500 border-green-500"
                    : "border-gray-600 hover:border-gray-400"
                }`}
              >
                {completedItems[ci.key] && <Check className="w-3 h-3 text-white" />}
              </button>
              <div className="flex-1 min-w-0">
                <Label className="text-gray-300 text-sm font-medium">{ci.label}</Label>
                <Input
                  value={form[ci.key]}
                  onChange={(e) => update(ci.key, e.target.value)}
                  placeholder={ci.placeholder}
                  className="mt-2 bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-green-500/50 text-sm"
                />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Signature */}
      <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-5 space-y-4">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-green-500/20 flex items-center justify-center text-xs text-green-400">4</span>
          Podpis klienta
        </h3>
        <Input
          value={form.client_signature}
          onChange={(e) => update("client_signature", e.target.value)}
          placeholder="Imię i nazwisko klienta"
          className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-green-500/50"
        />
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          onClick={handleSave}
          disabled={saving || !form.client_name.trim()}
          className="flex-1 h-12 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold rounded-xl shadow-lg shadow-green-500/20"
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : saved ? (
            <><Check className="w-5 h-5 mr-2" /> Zapisano raport!</>
          ) : (
            <><Save className="w-5 h-5 mr-2" /> Zapisz jako raport</>
          )}
        </Button>
        <Button
          onClick={handleReset}
          variant="outline"
          className="h-12 border-white/10 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl"
        >
          <RotateCcw className="w-4 h-4 mr-2" /> Wyczyść
        </Button>
      </div>
    </div>
  );
}