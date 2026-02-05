import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import PageHeader from "../components/shared/PageHeader";
import AutoconsumptionPieChart from "../components/charts/AutoconsumptionPieChart";

export default function AutoconsumptionCalc() {
  const [produkcja, setProdukcja] = useState("");
  const [eksport, setEksport] = useState("");
  const [zuzycie, setZuzycie] = useState("");
  const [result, setResult] = useState(null);

  const calculate = () => {
    const prod = parseFloat(produkcja);
    const exp = parseFloat(eksport);
    const zuz = parseFloat(zuzycie);

    if (isNaN(prod) || isNaN(exp) || prod <= 0) return;

    const auto = prod - exp;
    const pctAuto = ((auto / prod) * 100).toFixed(1);
    const pctExport = ((exp / prod) * 100).toFixed(1);

    let level, color, icon, message, recommendation;
    if (pctAuto < 30) {
      level = "Niska autokonsumpcja";
      color = "red";
      icon = "🔴";
      message = "Wymagana edukacja oraz zmiana nawyków korzystania z urządzeń energochłonnych.";
      recommendation = "Proponowane rozwiązanie: magazyn energii";
    } else if (pctAuto < 60) {
      level = "Średnia autokonsumpcja";
      color = "yellow";
      icon = "🟡";
      message = "Nie jest źle, ale może być lepiej!";
      recommendation = "Edukacja i rozważ montaż magazynu energii";
    } else {
      level = "Wysoka autokonsumpcja";
      color = "green";
      icon = "🟢";
      message = "Autokonsumpcja na wysokim poziomie.";
      recommendation = "Gratulacje! Świetny wynik.";
    }

    const res = { auto, pctAuto, pctExport, level, color, icon, message, recommendation };

    if (!isNaN(zuz) && zuz > 0) {
      res.importFromGrid = zuz - auto;
      res.pctGrid = ((res.importFromGrid / zuz) * 100).toFixed(1);
      res.pctOwn = ((auto / zuz) * 100).toFixed(1);
    }

    setResult(res);
  };

  const colorMap = {
    red: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-400", bar: "bg-red-500" },
    yellow: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400", bar: "bg-amber-500" },
    green: { bg: "bg-green-500/10", border: "border-green-500/30", text: "text-green-400", bar: "bg-green-500" },
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Calculator}
        title="Kalkulator Autokonsumpcji"
        subtitle="Oblicz opłacalność zużycia własnego"
        color="amber"
      />

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Wprowadź dane</h3>
        
        <div className="space-y-3">
          <div>
            <Label className="text-gray-700 text-xs mb-1">Produkcja prądu [kWh] *</Label>
            <Input
              type="number"
              value={produkcja}
              onChange={(e) => setProdukcja(e.target.value)}
              placeholder="np. 8500"
              className="text-lg h-12"
            />
          </div>
          <div>
            <Label className="text-gray-700 text-xs mb-1">Eksport do sieci [kWh] *</Label>
            <Input
              type="number"
              value={eksport}
              onChange={(e) => setEksport(e.target.value)}
              placeholder="np. 5200"
              className="text-lg h-12"
            />
          </div>
          <div>
            <Label className="text-gray-700 text-xs mb-1">Całkowite zużycie domu [kWh] <span className="text-green-600">(opcjonalne)</span></Label>
            <Input
              type="number"
              value={zuzycie}
              onChange={(e) => setZuzycie(e.target.value)}
              placeholder="np. 6800"
              className="text-lg h-12"
            />
          </div>
        </div>

        <Button
          onClick={calculate}
          disabled={!produkcja || !eksport}
          className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg text-base"
        >
          OBLICZ AUTOKONSUMPCJĘ
        </Button>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {/* Main result card */}
            <div className={`rounded-2xl border p-6 text-center ${
              result.color === 'green' ? 'bg-green-500 border-green-600' :
              result.color === 'yellow' ? 'bg-amber-500 border-amber-600' :
              'bg-red-500 border-red-600'
            }`}>
              <div className="text-lg font-bold text-white mb-2">{result.level}</div>
              <div className="text-6xl md:text-7xl font-black text-white my-4">{result.pctAuto}%</div>
              <div className="text-sm text-white/90 uppercase tracking-wider mb-3">AUTOKONSUMPCJI</div>
              <p className="text-sm text-white/95 mb-3">{result.message}</p>
              <div className="inline-block px-4 py-2 rounded-full bg-white/20 backdrop-blur">
                <span className="text-xs font-semibold text-white">{result.recommendation}</span>
              </div>
            </div>

            {/* Details */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
              <h4 className="text-sm font-semibold text-gray-900">Szczegóły energetyczne</h4>
              {[
                { label: "Produkcja prądu", value: `${parseFloat(produkcja).toFixed(1)} kWh` },
                { label: "Autokonsumpcja", value: `${result.auto.toFixed(1)} kWh` },
                { label: "Eksport do sieci", value: `${parseFloat(eksport).toFixed(1)} kWh (${result.pctExport}%)` },
              ].map((row) => (
                <div key={row.label} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-600">{row.label}</span>
                  <span className="text-sm font-semibold text-gray-900">{row.value}</span>
                </div>
              ))}
            </div>

            {result.pctOwn && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
                <h4 className="text-sm font-semibold text-gray-900">Analiza zużycia</h4>
                {[
                  { label: "Całkowite zużycie domu", value: `${parseFloat(zuzycie).toFixed(1)} kWh` },
                  { label: "Import z sieci", value: `${result.importFromGrid.toFixed(1)} kWh (${result.pctGrid}%)` },
                  { label: "Pokrycie własną energią", value: `${result.pctOwn}%`, highlight: true },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                    <span className="text-sm text-gray-600">{row.label}</span>
                    <span className={`text-sm font-semibold ${row.highlight ? "text-green-600" : "text-gray-900"}`}>{row.value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Visualization */}
            <AutoconsumptionPieChart
              production={parseFloat(produkcja)}
              exported={parseFloat(eksport)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}