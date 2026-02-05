import React, { useState } from "react";
import { MessageSquare, Save, RotateCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/shared/PageHeader";

const questions = [
  { key: "interview_annual_cost", label: "Jaki jest roczny koszt za energię elektryczną?", placeholder: "np. 4500 zł/rok" },
  { key: "interview_residents", label: "Ile osób zamieszkuje dom/mieszkanie?", placeholder: "np. 4 osoby" },
  { key: "interview_work_schedule", label: "O której godzinie domownicy wychodzą do pracy/szkoły?", placeholder: "np. 7:00-8:00" },
  { key: "interview_return_time", label: "O której godzinie zwykle wszyscy wracają do domu?", placeholder: "np. 16:00-18:00" },
  { key: "interview_home_during_day", label: "Czy ktoś jest w domu w godzinach 10:00-15:00?", placeholder: "np. Tak, pracuję zdalnie / Nie, dom jest pusty" },
  { key: "interview_peak_usage", label: "O jakiej porze dnia zużycie prądu jest największe?", placeholder: "np. Wieczorem 17-22" },
  { key: "interview_appliance_usage", label: "Kiedy najczęściej włączacie pralkę, zmywarkę i inne urządzenia?", placeholder: "np. Wieczorem po powrocie z pracy" },
  { key: "interview_water_heating", label: "Czym ogrzewana jest ciepła woda i kiedy najczęściej z niej korzystacie?", placeholder: "np. Bojler elektryczny, rano i wieczorem" },
  { key: "interview_equipment", label: "Jaki sprzęt elektryczny jest w domu?", placeholder: "np. Zmywarka, pralka, suszarka, klimatyzacja" },
  { key: "interview_purchase_plans", label: "Jakie plany zakupowe dotyczące urządzeń energochłonnych?", placeholder: "np. Samochód elektryczny, pompa ciepła" },
];

export default function Interview() {
  const [form, setForm] = useState({
    client_name: "",
    visit_date: new Date().toISOString().split("T")[0],
    interview_annual_cost: "",
    interview_residents: "",
    interview_work_schedule: "",
    interview_return_time: "",
    interview_home_during_day: "",
    interview_peak_usage: "",
    interview_appliance_usage: "",
    interview_water_heating: "",
    interview_equipment: "",
    interview_purchase_plans: "",
    client_signature: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeQ, setActiveQ] = useState(null);

  const update = (key, value) => setForm({ ...form, [key]: value });
  const filledCount = questions.filter((q) => form[q.key]?.trim()).length;

  const handleSave = async () => {
    if (!form.client_name.trim()) return;
    setSaving(true);
    const report = await base44.entities.VisitReport.create({
      ...form,
      status: "draft",
    });
    
    // Automatyczny eksport do Google Sheets
    try {
      await base44.functions.invoke('exportToGoogleSheets', { reportId: report.id });
    } catch (error) {
      console.error('Błąd eksportu do Google Sheets:', error);
    }
    
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    setForm({
      client_name: "",
      visit_date: new Date().toISOString().split("T")[0],
      interview_annual_cost: "",
      interview_residents: "",
      interview_work_schedule: "",
      interview_return_time: "",
      interview_home_during_day: "",
      interview_peak_usage: "",
      interview_appliance_usage: "",
      interview_water_heating: "",
      interview_equipment: "",
      interview_purchase_plans: "",
      client_signature: "",
    });
    setActiveQ(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wywiad z klientem"
        subtitle="Analiza potrzeb energetycznych"
      />

      {/* Progress indicator */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-600">Odpowiedzi</span>
          <span className="text-sm font-semibold text-green-600">{filledCount}/{questions.length}</span>
        </div>
        <div className="flex gap-1">
          {questions.map((q, i) => (
            <div
              key={i}
              className={`flex-1 h-2 rounded-full transition-all ${
                form[q.key]?.trim() ? "bg-green-500" : "bg-gray-100"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Client info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-gray-700 text-xs mb-1">Imię i nazwisko klienta *</Label>
            <Input
              value={form.client_name}
              onChange={(e) => update("client_name", e.target.value)}
              placeholder="Jan Kowalski"
            />
          </div>
          <div>
            <Label className="text-gray-700 text-xs mb-1">Data</Label>
            <Input
              type="date"
              value={form.visit_date}
              onChange={(e) => update("visit_date", e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-3">
        {questions.map((q, i) => (
          <motion.div
            key={q.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => setActiveQ(q.key)}
            className={`bg-white rounded-xl border p-5 transition-all cursor-pointer ${
              activeQ === q.key
                ? "border-green-500 bg-green-50"
                : form[q.key]?.trim()
                ? "border-green-200 bg-green-50/50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <Label className="text-gray-900 text-sm font-medium">{q.label}</Label>
                <Input
                  value={form[q.key]}
                  onChange={(e) => update(q.key, e.target.value)}
                  placeholder={q.placeholder}
                  className="mt-2 text-sm"
                />
              </div>
              {form[q.key]?.trim() && (
                <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shrink-0 mt-1">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Signature */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <Label className="text-gray-700 text-xs mb-1">Podpis klienta</Label>
        <Input
          value={form.client_signature}
          onChange={(e) => update("client_signature", e.target.value)}
          placeholder="Imię i nazwisko"
        />
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          onClick={handleSave}
          disabled={saving || !form.client_name.trim()}
          className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg"
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : saved ? (
            <><Check className="w-5 h-5 mr-2" /> Zapisano!</>
          ) : (
            <><Save className="w-5 h-5 mr-2" /> Zapisz wywiad</>
          )}
        </Button>
        <Button
          onClick={handleReset}
          variant="outline"
          className="h-12 rounded-lg"
        >
          <RotateCcw className="w-4 h-4 mr-2" /> Wyczyść
        </Button>
      </div>
    </div>
  );
}