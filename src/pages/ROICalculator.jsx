import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";
import { Download, TrendingUp, Calculator } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { base44 } from "@/api/base44Client";
import { toast } from "react-hot-toast";

export default function ROICalculator() {
  const [kosztInstalacji, setKosztInstalacji] = useState("");
  const [rocznaProdukcja, setRocznaProdukcja] = useState("");
  const [cenaPradu, setCenaPradu] = useState("");
  const [kosztUtrzymania, setKosztUtrzymania] = useState("200");
  const [inflacjaEnergii, setInflacjaEnergii] = useState("5");
  const [degradacjaPaneli, setDegradacjaPaneli] = useState("0.5");
  const [result, setResult] = useState(null);
  const [energyPrice, setEnergyPrice] = useState(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  useEffect(() => {
    const fetchEnergyPrice = async () => {
      try {
        const { data } = await base44.functions.invoke('getEnergyPrices', {});
        setEnergyPrice(data);
        if (!cenaPradu) {
          setCenaPradu(data.gross_price.toString());
        }
      } catch (error) {
        console.error('Failed to fetch energy prices:', error);
      }
    };
    fetchEnergyPrice();
  }, []);

  const calculate = () => {
    const koszt = parseFloat(kosztInstalacji);
    const produkcja = parseFloat(rocznaProdukcja);
    const cena = parseFloat(cenaPradu);
    const utrzymanie = parseFloat(kosztUtrzymania);
    const inflacja = parseFloat(inflacjaEnergii) / 100;
    const degradacja = parseFloat(degradacjaPaneli) / 100;

    if (isNaN(koszt) || isNaN(produkcja) || isNaN(cena)) return;

    const lata = 25;
    let skumulowaneOszczednosci = 0;
    let rokZwrotu = null;
    const dataRoczna = [];
    const dataMiesieczna = [];

    for (let rok = 1; rok <= lata; rok++) {
      const cenaWRoku = cena * Math.pow(1 + inflacja, rok - 1);
      const produkcjaWRoku = produkcja * Math.pow(1 - degradacja, rok - 1);
      const oszczednosciRoczne = produkcjaWRoku * cenaWRoku * 0.7 - utrzymanie;
      skumulowaneOszczednosci += oszczednosciRoczne;

      dataRoczna.push({
        rok: `Rok ${rok}`,
        oszczednosci: Math.round(oszczednosciRoczne),
        skumulowane: Math.round(skumulowaneOszczednosci),
        zysk: Math.round(skumulowaneOszczednosci - koszt),
        cenaPradu: cenaWRoku.toFixed(2),
        produkcja: Math.round(produkcjaWRoku)
      });

      if (!rokZwrotu && skumulowaneOszczednosci >= koszt) {
        rokZwrotu = rok;
      }
    }

    // Miesięczna projekcja pierwszego roku
    for (let miesiac = 1; miesiac <= 12; miesiac++) {
      const oszczednosciMiesieczne = (produkcja * cena * 0.7) / 12;
      dataMiesieczna.push({
        miesiac: `M${miesiac}`,
        oszczednosci: Math.round(oszczednosciMiesieczne)
      });
    }

    const roiProcent = ((skumulowaneOszczednosci - koszt) / koszt * 100).toFixed(1);
    const srednioRocznie = (skumulowaneOszczednosci / lata).toFixed(0);
    const zyskCalkowity = skumulowaneOszczednosci - koszt;

    setResult({
      rokZwrotu,
      roiProcent,
      srednioRocznie,
      zyskCalkowity,
      skumulowaneOszczednosci,
      dataRoczna,
      dataMiesieczna,
      oszczednosciPierwszyRok: dataRoczna[0].oszczednosci
    });
  };

  const handleDownloadPDF = async () => {
    if (!result) return;
    
    setGeneratingPDF(true);
    try {
      const { data } = await base44.functions.invoke('generateROICalculatorPDF', {
        kosztInstalacji,
        rocznaProdukcja,
        cenaPradu,
        kosztUtrzymania,
        inflacjaEnergii,
        degradacjaPaneli,
        result
      });

      const blob = new Blob([data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analiza-roi-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      toast.success('PDF wygenerowany');
    } catch (error) {
      console.error('Błąd generowania PDF:', error);
      toast.error('Nie udało się wygenerować PDF');
    } finally {
      setGeneratingPDF(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kalkulator Opłacalności (ROI)"
        subtitle="Szczegółowa analiza zwrotu z inwestycji w instalację PV"
      />

      {energyPrice && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
          <div className="text-xs text-gray-600 mb-1">Aktualna cena energii (taryfa dynamiczna):</div>
          <div className="flex items-baseline gap-2">
            <div className="text-sm font-semibold text-gray-900">
              Brutto: <span className="text-green-600">{energyPrice.gross_price} zł/kWh</span>
            </div>
            <div className="text-xs text-gray-500">
              ({energyPrice.tax_percentage}% podatki i opłaty)
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Parametry inwestycji</h3>
        
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label className="text-gray-700 text-xs mb-1">Koszt instalacji [zł] *</Label>
            <Input
              type="number"
              value={kosztInstalacji}
              onChange={(e) => setKosztInstalacji(e.target.value)}
              placeholder="np. 35000"
              className="text-lg h-12"
            />
          </div>
          <div>
            <Label className="text-gray-700 text-xs mb-1">Roczna produkcja [kWh] *</Label>
            <Input
              type="number"
              value={rocznaProdukcja}
              onChange={(e) => setRocznaProdukcja(e.target.value)}
              placeholder="np. 8500"
              className="text-lg h-12"
            />
          </div>
          <div>
            <Label className="text-gray-700 text-xs mb-1">Cena prądu brutto [zł/kWh] *</Label>
            <Input
              type="number"
              step="0.01"
              value={cenaPradu}
              onChange={(e) => setCenaPradu(e.target.value)}
              placeholder="1.50"
              className="text-lg h-12"
            />
          </div>
          <div>
            <Label className="text-gray-700 text-xs mb-1">Koszt utrzymania roczny [zł]</Label>
            <Input
              type="number"
              value={kosztUtrzymania}
              onChange={(e) => setKosztUtrzymania(e.target.value)}
              placeholder="200"
              className="text-lg h-12"
            />
          </div>
          <div>
            <Label className="text-gray-700 text-xs mb-1">Inflacja cen energii [%]</Label>
            <Input
              type="number"
              step="0.1"
              value={inflacjaEnergii}
              onChange={(e) => setInflacjaEnergii(e.target.value)}
              placeholder="5"
              className="text-lg h-12"
            />
          </div>
          <div>
            <Label className="text-gray-700 text-xs mb-1">Degradacja paneli [%/rok]</Label>
            <Input
              type="number"
              step="0.1"
              value={degradacjaPaneli}
              onChange={(e) => setDegradacjaPaneli(e.target.value)}
              placeholder="0.5"
              className="text-lg h-12"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={calculate}
            disabled={!kosztInstalacji || !rocznaProdukcja || !cenaPradu}
            className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg text-base"
          >
            <Calculator className="w-5 h-5 mr-2" />
            OBLICZ OPŁACALNOŚĆ
          </Button>
          {result && (
            <Button
              onClick={handleDownloadPDF}
              disabled={generatingPDF}
              variant="outline"
              className="h-12 px-4"
              title="Pobierz PDF"
            >
              <Download className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Key metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-green-500 rounded-xl p-4 text-center">
                <div className="text-xs text-white/80 mb-1">Zwrot w</div>
                <div className="text-3xl font-black text-white">{result.rokZwrotu || "25+"}</div>
                <div className="text-xs text-white/90">lat</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className="text-xs text-gray-600 mb-1">ROI</div>
                <div className="text-3xl font-black text-green-600">{result.roiProcent}%</div>
                <div className="text-xs text-gray-500">w 25 lat</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className="text-xs text-gray-600 mb-1">Średnio/rok</div>
                <div className="text-xl font-bold text-gray-900">{result.srednioRocznie} zł</div>
                <div className="text-xs text-gray-500">oszczędności</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className="text-xs text-gray-600 mb-1">Zysk całkowity</div>
                <div className="text-xl font-bold text-green-600">{result.zyskCalkowity.toLocaleString()} zł</div>
                <div className="text-xs text-gray-500">po 25 latach</div>
              </div>
            </div>

            {/* Cumulative savings chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h4 className="text-base font-semibold text-gray-900 mb-4">Skumulowane oszczędności vs Koszt inwestycji</h4>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={result.dataRoczna}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="rok" tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                    formatter={(value) => `${Math.round(value).toLocaleString()} zł`}
                  />
                  <Legend />
                  <ReferenceLine y={parseFloat(kosztInstalacji)} stroke="#ef4444" strokeDasharray="5 5" label="Koszt" />
                  <Line type="monotone" dataKey="skumulowane" stroke="#22c55e" strokeWidth={3} name="Skumulowane oszczędności" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Yearly profit chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h4 className="text-base font-semibold text-gray-900 mb-4">Zysk netto rok po roku</h4>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={result.dataRoczna.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="rok" tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                    formatter={(value) => `${Math.round(value).toLocaleString()} zł`}
                  />
                  <Bar dataKey="zysk" fill="#22c55e" radius={[8, 8, 0, 0]} name="Zysk netto" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Detailed yearly breakdown */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h4 className="text-base font-semibold text-gray-900 mb-4">Szczegółowa analiza roczna</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200">
                    <tr>
                      <th className="text-left py-2 px-3 text-gray-600 font-medium">Rok</th>
                      <th className="text-right py-2 px-3 text-gray-600 font-medium">Produkcja</th>
                      <th className="text-right py-2 px-3 text-gray-600 font-medium">Cena prądu</th>
                      <th className="text-right py-2 px-3 text-gray-600 font-medium">Oszczędności</th>
                      <th className="text-right py-2 px-3 text-gray-600 font-medium">Skumulowane</th>
                      <th className="text-right py-2 px-3 text-gray-600 font-medium">Zysk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.dataRoczna.slice(0, 10).map((row, idx) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-3 font-medium">{row.rok}</td>
                        <td className="text-right py-2 px-3">{row.produkcja.toLocaleString()} kWh</td>
                        <td className="text-right py-2 px-3">{row.cenaPradu} zł</td>
                        <td className="text-right py-2 px-3 text-green-600">{row.oszczednosci.toLocaleString()} zł</td>
                        <td className="text-right py-2 px-3 font-semibold">{row.skumulowane.toLocaleString()} zł</td>
                        <td className={`text-right py-2 px-3 font-semibold ${row.zysk > 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {row.zysk.toLocaleString()} zł
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 text-xs text-gray-500 text-center">
                Pokazano pierwsze 10 lat • Pełna analiza 25 lat w PDF
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 p-5">
              <h4 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                Podsumowanie inwestycji
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Koszt początkowy:</span>
                  <span className="font-semibold text-gray-900">{parseFloat(kosztInstalacji).toLocaleString()} zł</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Okres zwrotu:</span>
                  <span className="font-semibold text-green-600">{result.rokZwrotu || "25+"} lat</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Całkowite oszczędności (25 lat):</span>
                  <span className="font-semibold text-green-600">{result.skumulowaneOszczednosci.toLocaleString()} zł</span>
                </div>
                <div className="flex justify-between border-t border-green-200 pt-2">
                  <span className="text-gray-900 font-semibold">Zysk netto:</span>
                  <span className="font-bold text-green-600 text-lg">{result.zyskCalkowity.toLocaleString()} zł</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}