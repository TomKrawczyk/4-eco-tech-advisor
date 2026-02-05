import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import PageHeader from "../components/shared/PageHeader";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function PVCalculator() {
  const [zuzycie, setZuzycie] = useState("");
  const [orientacja, setOrientacja] = useState("1.0");
  const [cenaPradu, setCenaPradu] = useState("0.90");
  const [cenaHandlowca, setCenaHandlowca] = useState("");
  const [result, setResult] = useState(null);

  const calculate = () => {
    const zuz = parseFloat(zuzycie);
    const orient = parseFloat(orientacja);
    const cena = parseFloat(cenaPradu);
    const cenaH = parseFloat(cenaHandlowca);

    if (isNaN(zuz) || isNaN(cena)) return;

    const produkcjaNaKwp = 1000 * orient;
    const wymaganaMocKw = (zuz * 1.2) / produkcjaNaKwp;

    let mocPanela, liczbaPaneli;
    if (wymaganaMocKw <= 3.68) {
      mocPanela = 450;
      liczbaPaneli = Math.ceil((wymaganaMocKw * 1000) / mocPanela);
      if (liczbaPaneli > 8) liczbaPaneli = 8;
    } else {
      mocPanela = 480;
      liczbaPaneli = Math.ceil((wymaganaMocKw * 1000) / mocPanela);
    }

    const mocInstalacji = (liczbaPaneli * mocPanela / 1000).toFixed(2);
    const rocznaProdukcja = Math.round(mocInstalacji * produkcjaNaKwp);
    const oszczednosciRoczne = rocznaProdukcja * cena * 0.7;

    let rokZwrotu = null;
    if (!isNaN(cenaH) && cenaH > 0) {
      let suma = 0;
      for (let rok = 1; rok <= 25; rok++) {
        const cenaWRoku = cena * Math.pow(1.05, rok - 1);
        suma += rocznaProdukcja * cenaWRoku * 0.7;
        if (suma >= cenaH) {
          rokZwrotu = rok;
          break;
        }
      }
    }

    setResult({
      mocInstalacji,
      liczbaPaneli,
      mocPanela,
      rocznaProdukcja,
      oszczednosciRoczne,
      kosztInstalacji: !isNaN(cenaH) ? cenaH : null,
      rokZwrotu,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Sun}
        title="Kalkulator Instalacji PV"
        subtitle="Dobierz moc instalacji i sprawdź zysk"
        color="yellow"
      />

      <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-5 space-y-4">
        <div className="space-y-3">
          <div>
            <Label className="text-gray-400 text-xs mb-1">Roczne zużycie energii [kWh] *</Label>
            <Input
              type="number"
              value={zuzycie}
              onChange={(e) => setZuzycie(e.target.value)}
              placeholder="np. 5000"
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-yellow-500/50 text-lg h-12"
            />
          </div>

          <div>
            <Label className="text-gray-400 text-xs mb-1">Orientacja dachu</Label>
            <Select value={orientacja} onValueChange={setOrientacja}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1.0">Południe (100%)</SelectItem>
                <SelectItem value="0.9">Płd-Wsch / Płd-Zach (90%)</SelectItem>
                <SelectItem value="0.8">Wschód / Zachód (80%)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-gray-400 text-xs mb-1">Cena prądu [zł/kWh] *</Label>
            <Input
              type="number"
              step="0.01"
              value={cenaPradu}
              onChange={(e) => setCenaPradu(e.target.value)}
              placeholder="0.90"
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-yellow-500/50 text-lg h-12"
            />
          </div>

          <div>
            <Label className="text-gray-400 text-xs mb-1">
              Cena instalacji [zł] <span className="text-green-400">(opcjonalne)</span>
            </Label>
            <Input
              type="number"
              value={cenaHandlowca}
              onChange={(e) => setCenaHandlowca(e.target.value)}
              placeholder="np. 25000"
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-yellow-500/50 text-lg h-12"
            />
          </div>
        </div>

        <Button
          onClick={calculate}
          disabled={!zuzycie || !cenaPradu}
          className="w-full h-12 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white font-semibold rounded-xl text-base"
        >
          <Sun className="w-5 h-5 mr-2" /> OBLICZ INSTALACJĘ
        </Button>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Key stats */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Sun, label: "Moc instalacji", value: `${result.mocInstalacji} kWp`, color: "yellow" },
                { icon: Zap, label: "Produkcja roczna", value: `${result.rocznaProdukcja} kWh`, color: "green" },
                { icon: DollarSign, label: "Oszczędności /rok", value: `${result.oszczednosciRoczne.toFixed(0)} zł`, color: "emerald" },
                { icon: Calendar, label: "Panele", value: `${result.liczbaPaneli}× ${result.mocPanela}Wp`, color: "blue" },
              ].map((stat) => (
                <div key={stat.label} className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-4">
                  <stat.icon className={`w-5 h-5 text-${stat.color}-400 mb-2`} />
                  <div className="text-lg md:text-xl font-bold text-white">{stat.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>

            {result.rokZwrotu && (
              <div className="bg-green-500/10 rounded-2xl border border-green-500/20 p-5 text-center">
                <TrendingUp className="w-6 h-6 text-green-400 mx-auto mb-2" />
                <div className="text-sm text-gray-400">Zwrot inwestycji w</div>
                <div className="text-3xl font-black text-green-400 my-1">{result.rokZwrotu} lat</div>
                {result.kosztInstalacji && (
                  <div className="text-xs text-gray-500">Koszt instalacji: {result.kosztInstalacji.toLocaleString()} zł</div>
                )}
              </div>
            )}

            {/* Details table */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
              <h4 className="text-sm font-semibold text-gray-900">Szczegóły kalkulacji</h4>
              {[
                { label: "Moc instalacji", value: `${result.mocInstalacji} kWp` },
                { label: "Liczba paneli", value: `${result.liczbaPaneli} szt. (${result.mocPanela}Wp)` },
                { label: "Roczna produkcja", value: `${result.rocznaProdukcja} kWh` },
                { label: "Oszczędności roczne", value: `${result.oszczednosciRoczne.toFixed(2)} zł` },
                ...(result.kosztInstalacji ? [{ label: "Koszt instalacji", value: `${result.kosztInstalacji.toLocaleString()} zł` }] : []),
                ...(result.rokZwrotu ? [{ label: "Zwrot inwestycji", value: `${result.rokZwrotu} lat` }] : []),
              ].map((row) => (
                <div key={row.label} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-600">{row.label}</span>
                  <span className="text-sm font-semibold text-gray-900">{row.value}</span>
                </div>
              ))}
            </div>

            {/* Savings chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h4 className="text-base font-semibold text-gray-900 mb-4">Oszczędności w czasie</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={[
                  { rok: "Rok 1", oszczednosci: result.oszczednosciRoczne },
                  { rok: "Rok 5", oszczednosci: result.oszczednosciRoczne * 5 },
                  { rok: "Rok 10", oszczednosci: result.oszczednosciRoczne * 10 },
                  { rok: "Rok 15", oszczednosci: result.oszczednosciRoczne * 15 },
                  { rok: "Rok 20", oszczednosci: result.oszczednosciRoczne * 20 },
                  { rok: "Rok 25", oszczednosci: result.oszczednosciRoczne * 25 }
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="rok" tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                    formatter={(value) => `${Math.round(value).toLocaleString()} zł`}
                  />
                  <Bar dataKey="oszczednosci" fill="#22c55e" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}