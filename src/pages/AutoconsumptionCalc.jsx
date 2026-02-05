import React, { useState } from "react";
import { Calculator, Zap, ArrowDown, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import PageHeader from "../components/shared/PageHeader";

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

      <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Wprowadź dane</h3>
        
        <div className="space-y-3">
          <div>
            <Label className="text-gray-400 text-xs mb-1">Produkcja prądu [kWh] *</Label>
            <Input
              type="number"
              value={produkcja}
              onChange={(e) => setProdukcja(e.target.value)}
              placeholder="np. 8500"
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-amber-500/50 text-lg h-12"
            />
          </div>
          <div>
            <Label className="text-gray-400 text-xs mb-1">Eksport do sieci [kWh] *</Label>
            <Input
              type="number"
              value={eksport}
              onChange={(e) => setEksport(e.target.value)}
              placeholder="np. 5200"
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-amber-500/50 text-lg h-12"
            />
          </div>
          <div>
            <Label className="text-gray-400 text-xs mb-1">Całkowite zużycie domu [kWh] <span className="text-green-400">(opcjonalne)</span></Label>
            <Input
              type="number"
              value={zuzycie}
              onChange={(e) => setZuzycie(e.target.value)}
              placeholder="np. 6800"
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-amber-500/50 text-lg h-12"
            />
          </div>
        </div>

        <Button
          onClick={calculate}
          disabled={!produkcja || !eksport}
          className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold rounded-xl text-base"
        >
          <Zap className="w-5 h-5 mr-2" /> OBLICZ AUTOKONSUMPCJĘ
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
            <div className={`rounded-2xl border ${colorMap[result.color].border} ${colorMap[result.color].bg} p-6 text-center`}>
              <div className="text-3xl mb-2">{result.icon}</div>
              <div className={`text-lg font-bold ${colorMap[result.color].text}`}>{result.level}</div>
              <div className="text-5xl md:text-6xl font-black text-white my-4">{result.pctAuto}%</div>
              <div className="text-sm text-gray-400 uppercase tracking-wider mb-3">AUTOKONSUMPCJI</div>
              <p className="text-sm text-gray-300">{result.message}</p>
              <div className={`mt-3 inline-block px-4 py-2 rounded-full ${colorMap[result.color].bg} border ${colorMap[result.color].border}`}>
                <span className={`text-xs font-semibold ${colorMap[result.color].text}`}>{result.recommendation}</span>
              </div>
            </div>

            {/* Details */}
            <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-5 space-y-3">
              <h4 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-400" /> Szczegóły energetyczne
              </h4>
              {[
                { label: "Produkcja prądu", value: `${parseFloat(produkcja).toFixed(1)} kWh` },
                { label: "Autokonsumpcja", value: `${result.auto.toFixed(1)} kWh` },
                { label: "Eksport do sieci", value: `${parseFloat(eksport).toFixed(1)} kWh (${result.pctExport}%)` },
              ].map((row) => (
                <div key={row.label} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                  <span className="text-sm text-gray-400">{row.label}</span>
                  <span className="text-sm font-semibold text-white">{row.value}</span>
                </div>
              ))}
            </div>

            {result.pctOwn && (
              <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-5 space-y-3">
                <h4 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                  <ArrowDown className="w-4 h-4 text-blue-400" /> Analiza zużycia
                </h4>
                {[
                  { label: "Całkowite zużycie domu", value: `${parseFloat(zuzycie).toFixed(1)} kWh` },
                  { label: "Import z sieci", value: `${result.importFromGrid.toFixed(1)} kWh (${result.pctGrid}%)` },
                  { label: "Pokrycie własną energią", value: `${result.pctOwn}%`, highlight: true },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                    <span className="text-sm text-gray-400">{row.label}</span>
                    <span className={`text-sm font-semibold ${row.highlight ? "text-green-400" : "text-white"}`}>{row.value}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}