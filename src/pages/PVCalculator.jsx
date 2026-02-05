import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import PageHeader from "../components/shared/PageHeader";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { base44 } from "@/api/base44Client";
import { Cloud, TrendingUp } from "lucide-react";

export default function PVCalculator() {
  const [zuzycie, setZuzycie] = useState("");
  const [orientacja, setOrientacja] = useState("1.0");
  const [cenaPradu, setCenaPradu] = useState("1.50");
  const [cenaHandlowca, setCenaHandlowca] = useState("");
  const [result, setResult] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [energyPrice, setEnergyPrice] = useState(null);
  const [loadingWeather, setLoadingWeather] = useState(false);

  // Pobierz cenę energii przy załadowaniu
  useEffect(() => {
    const fetchEnergyPrice = async () => {
      try {
        const { data } = await base44.functions.invoke('getEnergyPrices', {});
        setEnergyPrice(data);
        if (!cenaPradu || cenaPradu === "0.90") {
          setCenaPradu(data.gross_price.toString());
        }
      } catch (error) {
        console.error('Failed to fetch energy prices:', error);
      }
    };
    fetchEnergyPrice();
  }, []);

  // Pobierz prognozę pogody
  const fetchWeatherForecast = async () => {
    setLoadingWeather(true);
    try {
      const { data } = await base44.functions.invoke('getWeatherForecast', {
        lat: 52.23,
        lon: 21.01
      });
      setWeatherData(data);
    } catch (error) {
      console.error('Failed to fetch weather:', error);
    } finally {
      setLoadingWeather(false);
    }
  };

  const calculate = () => {
    const zuz = parseFloat(zuzycie);
    const orient = parseFloat(orientacja);
    const cena = parseFloat(cenaPradu);
    const cenaH = parseFloat(cenaHandlowca);

    if (isNaN(zuz) || isNaN(cena)) return;

    // Uwzględnij prognozę pogody jeśli dostępna
    let productionMultiplier = 1.0;
    if (weatherData?.summary?.avg_production_factor) {
      productionMultiplier = weatherData.summary.avg_production_factor / 100;
    }

    const produkcjaNaKwp = 1000 * orient * productionMultiplier;
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
        title="Kalkulator Instalacji PV"
        subtitle="Dobierz moc instalacji i sprawdź zysk"
      />

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        {/* Energy price info */}
        {energyPrice && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200 space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-xs text-gray-600 mb-1">Cena energii (taryfa dynamiczna):</div>
                <div className="flex items-baseline gap-2">
                  <div className="text-sm font-semibold text-gray-900">
                    Netto: <span className="text-green-600">{energyPrice.net_price} zł/kWh</span>
                  </div>
                  <div className="text-sm font-semibold text-gray-900">
                    Brutto: <span className="text-gray-700">{energyPrice.gross_price} zł/kWh</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-amber-50 rounded px-3 py-2 border border-amber-200">
              <div className="text-xs text-amber-800">
                <span className="font-semibold">⚠️ Uwaga:</span> Aż <span className="font-bold">{energyPrice.tax_percentage}% ceny energii</span> to podatki i opłaty (akcyza, VAT, opłaty sieciowe, OZE)
              </div>
            </div>
            
            <div className="text-xs text-gray-500">
              Źródło: {energyPrice.source} • {new Date(energyPrice.timestamp).toLocaleString('pl-PL', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <Label className="text-gray-700 text-xs mb-1">Roczne zużycie energii [kWh] *</Label>
            <Input
              type="number"
              value={zuzycie}
              onChange={(e) => setZuzycie(e.target.value)}
              placeholder="np. 5000"
              className="text-lg h-12"
            />
          </div>

          <div>
            <Label className="text-gray-700 text-xs mb-1">Orientacja dachu</Label>
            <Select value={orientacja} onValueChange={setOrientacja}>
              <SelectTrigger className="h-12">
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
            <Label className="text-gray-700 text-xs mb-1">Cena prądu brutto [zł/kWh] *</Label>
            <Input
              type="number"
              step="0.01"
              value={cenaPradu}
              onChange={(e) => setCenaPradu(e.target.value)}
              placeholder="1.50"
              className="text-lg h-12"
            />
            <p className="text-xs text-gray-500 mt-1">Aktualna średnia cena brutto w Polsce: ~1.50 zł/kWh</p>
          </div>

          <div>
            <Label className="text-gray-700 text-xs mb-1">
              Cena instalacji [zł] <span className="text-green-600">(opcjonalne)</span>
            </Label>
            <Input
              type="number"
              value={cenaHandlowca}
              onChange={(e) => setCenaHandlowca(e.target.value)}
              placeholder="np. 25000"
              className="text-lg h-12"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={calculate}
            disabled={!zuzycie || !cenaPradu}
            className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg text-base"
          >
            OBLICZ INSTALACJĘ
          </Button>
          <Button
            onClick={fetchWeatherForecast}
            disabled={loadingWeather}
            variant="outline"
            className="h-12 px-4"
          >
            <Cloud className="w-5 h-5" />
          </Button>
        </div>

        {/* Weather forecast */}
        {weatherData && (
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <Cloud className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-semibold text-gray-900">Prognoza pogody (7 dni)</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-600">Śr. godziny słoneczne:</span>
                <div className="font-semibold text-gray-900">{weatherData.summary.avg_sun_hours}h/dzień</div>
              </div>
              <div>
                <span className="text-gray-600">Potencjał produkcji:</span>
                <div className="font-semibold text-blue-600">{weatherData.summary.avg_production_factor}%</div>
              </div>
            </div>
          </div>
        )}
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
                { label: "Moc instalacji", value: `${result.mocInstalacji} kWp` },
                { label: "Produkcja roczna", value: `${result.rocznaProdukcja} kWh` },
                { label: "Oszczędności /rok", value: `${result.oszczednosciRoczne.toFixed(0)} zł` },
                { label: "Panele", value: `${result.liczbaPaneli}× ${result.mocPanela}Wp` },
              ].map((stat) => (
                <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="text-lg md:text-xl font-bold text-gray-900">{stat.value}</div>
                  <div className="text-xs text-gray-600 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>

            {result.rokZwrotu && (
              <div className="bg-green-500 rounded-2xl border border-green-600 p-5 text-center">
                <div className="text-sm text-white/90">Zwrot inwestycji w</div>
                <div className="text-4xl font-black text-white my-2">{result.rokZwrotu} lat</div>
                {result.kosztInstalacji && (
                  <div className="text-xs text-white/80">Koszt instalacji: {result.kosztInstalacji.toLocaleString()} zł</div>
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