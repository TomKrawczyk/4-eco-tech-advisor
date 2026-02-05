import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import PageHeader from "../components/shared/PageHeader";
import { TrendingUp, AlertTriangle, Zap, MapPin } from "lucide-react";

export default function Analytics() {
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["visitReports"],
    queryFn: () => base44.entities.VisitReport.list("-created_date", 200),
  });

  // 1. Najczęstsze problemy techniczne
  const technicalIssues = useMemo(() => {
    const issues = {};
    
    reports.forEach(r => {
      // Analiza różnych warunków technicznych
      const conditions = [
        { field: r.panels_condition, category: "Panele" },
        { field: r.mounting_condition, category: "Mocowania" },
        { field: r.cables_condition, category: "Przewody" },
        { field: r.protection_condition, category: "Zabezpieczenia" },
        { field: r.inverter_reading, category: "Falownik" },
        { field: r.grounding_condition, category: "Uziemienie" }
      ];

      conditions.forEach(({ field, category }) => {
        if (field && (
          field.toLowerCase().includes('problem') ||
          field.toLowerCase().includes('uszkodz') ||
          field.toLowerCase().includes('wymaga') ||
          field.toLowerCase().includes('złe') ||
          field.toLowerCase().includes('zły') ||
          field.toLowerCase().includes('korozj') ||
          field.toLowerCase().includes('pęk') ||
          field.toLowerCase().includes('brud')
        )) {
          issues[category] = (issues[category] || 0) + 1;
        }
      });
    });

    return Object.entries(issues)
      .map(([name, count]) => ({ name, count, percentage: ((count / reports.length) * 100).toFixed(1) }))
      .sort((a, b) => b.count - a.count);
  }, [reports]);

  // 2. Efektywność instalacji wg typu
  const efficiencyByType = useMemo(() => {
    const typeStats = {};

    reports.forEach(r => {
      if (!r.installation_types?.length || !r.annual_production_kwh || !r.energy_exported_kwh) return;

      r.installation_types.forEach(type => {
        if (!typeStats[type]) {
          typeStats[type] = { 
            type, 
            totalProduction: 0, 
            totalExport: 0, 
            count: 0,
            locations: new Set()
          };
        }

        const autoConsumption = ((r.annual_production_kwh - r.energy_exported_kwh) / r.annual_production_kwh) * 100;
        
        typeStats[type].totalProduction += r.annual_production_kwh;
        typeStats[type].totalExport += r.energy_exported_kwh;
        typeStats[type].count += 1;
        if (r.client_address) {
          typeStats[type].locations.add(r.client_address.split(',')[0]);
        }
      });
    });

    return Object.values(typeStats).map(stat => ({
      type: stat.type,
      avgProduction: Math.round(stat.totalProduction / stat.count),
      avgAutoconsumption: (((stat.totalProduction - stat.totalExport) / stat.totalProduction) * 100).toFixed(1),
      count: stat.count,
      locations: stat.locations.size
    }));
  }, [reports]);

  // 3. Trendy autokonsumpcji w czasie
  const timelineTrends = useMemo(() => {
    const monthlyData = {};

    reports.forEach(r => {
      if (!r.visit_date || !r.annual_production_kwh || !r.energy_exported_kwh) return;

      const date = new Date(r.visit_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthKey,
          totalProduction: 0,
          totalExport: 0,
          totalImport: 0,
          count: 0
        };
      }

      monthlyData[monthKey].totalProduction += r.annual_production_kwh;
      monthlyData[monthKey].totalExport += r.energy_exported_kwh;
      if (r.energy_imported_kwh) {
        monthlyData[monthKey].totalImport += r.energy_imported_kwh;
      }
      monthlyData[monthKey].count += 1;
    });

    return Object.values(monthlyData)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(m => ({
        month: m.month,
        avgProduction: Math.round(m.totalProduction / m.count),
        avgAutoconsumption: (((m.totalProduction - m.totalExport) / m.totalProduction) * 100).toFixed(1),
        avgExport: Math.round(m.totalExport / m.count),
        count: m.count
      }));
  }, [reports]);

  // 4. Statystyki według lokalizacji
  const locationStats = useMemo(() => {
    const locations = {};

    reports.forEach(r => {
      if (!r.client_address || !r.annual_production_kwh || !r.energy_exported_kwh) return;

      const city = r.client_address.split(',')[1]?.trim() || r.client_address.split(',')[0];
      
      if (!locations[city]) {
        locations[city] = {
          city,
          totalProduction: 0,
          totalExport: 0,
          count: 0
        };
      }

      locations[city].totalProduction += r.annual_production_kwh;
      locations[city].totalExport += r.energy_exported_kwh;
      locations[city].count += 1;
    });

    return Object.values(locations)
      .filter(l => l.count >= 2) // tylko lokalizacje z min 2 instalacjami
      .map(l => ({
        city: l.city,
        avgProduction: Math.round(l.totalProduction / l.count),
        avgAutoconsumption: (((l.totalProduction - l.totalExport) / l.totalProduction) * 100).toFixed(1),
        count: l.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [reports]);

  const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Analityka" subtitle="Zaawansowana analiza danych z raportów wizyt" />
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin mx-auto" />
          <p className="text-gray-600 mt-4">Ładowanie danych...</p>
        </div>
      </div>
    );
  }

  const validReports = reports.filter(r => r.annual_production_kwh && r.energy_exported_kwh);

  return (
    <div className="space-y-6">
      <PageHeader title="Analityka" subtitle="Zaawansowana analiza danych z raportów wizyt" />

      {/* Summary stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-gray-200 p-5"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Zap className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{reports.length}</div>
              <div className="text-xs text-gray-600">Wszystkie raporty</div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl border border-gray-200 p-5"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{validReports.length}</div>
              <div className="text-xs text-gray-600">Z danymi produkcji</div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl border border-gray-200 p-5"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{technicalIssues.length}</div>
              <div className="text-xs text-gray-600">Typy problemów</div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl border border-gray-200 p-5"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{locationStats.length}</div>
              <div className="text-xs text-gray-600">Analizowane lokalizacje</div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Technical Issues */}
      {technicalIssues.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-gray-200 p-6"
        >
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Najczęstsze problemy techniczne
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={technicalIssues}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" stroke="#666" />
              <YAxis stroke="#666" />
              <Tooltip 
                contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                formatter={(value, name) => [value + ' przypadków', name]}
              />
              <Bar dataKey="count" fill="#ef4444" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
            {technicalIssues.map((issue, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">{issue.name}</span>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-900">{issue.count}</div>
                  <div className="text-xs text-gray-500">{issue.percentage}%</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Efficiency by Type */}
      {efficiencyByType.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-gray-200 p-6"
        >
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-green-500" />
            Efektywność według typu instalacji
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">Typ instalacji</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-900">Średnia produkcja</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-900">Autokonsumpcja</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-900">Liczba instalacji</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-900">Lokalizacje</th>
                </tr>
              </thead>
              <tbody>
                {efficiencyByType.map((stat, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0">
                    <td className="py-3 px-4 text-sm text-gray-900">{stat.type}</td>
                    <td className="py-3 px-4 text-sm text-right text-gray-900">{stat.avgProduction.toLocaleString()} kWh</td>
                    <td className="py-3 px-4 text-right">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        stat.avgAutoconsumption >= 60 ? 'bg-green-100 text-green-700' :
                        stat.avgAutoconsumption >= 40 ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {stat.avgAutoconsumption}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-right text-gray-900">{stat.count}</td>
                    <td className="py-3 px-4 text-sm text-right text-gray-900">{stat.locations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Timeline trends */}
      {timelineTrends.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-gray-200 p-6"
        >
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            Trendy autokonsumpcji w czasie
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timelineTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" stroke="#666" />
              <YAxis stroke="#666" />
              <Tooltip 
                contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
              />
              <Legend />
              <Line type="monotone" dataKey="avgProduction" stroke="#22c55e" strokeWidth={2} name="Średnia produkcja (kWh)" />
              <Line type="monotone" dataKey="avgAutoconsumption" stroke="#3b82f6" strokeWidth={2} name="Autokonsumpcja (%)" />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-4 text-sm text-gray-600">
            <p>Wykres przedstawia średnie wartości produkcji energii oraz autokonsumpcji w poszczególnych miesiącach na podstawie {validReports.length} raportów.</p>
          </div>
        </motion.div>
      )}

      {/* Location stats */}
      {locationStats.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-gray-200 p-6"
        >
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-purple-500" />
            Efektywność według lokalizacji (min. 2 instalacje)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={locationStats} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" stroke="#666" />
              <YAxis type="category" dataKey="city" stroke="#666" width={120} />
              <Tooltip 
                contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
              />
              <Bar dataKey="avgAutoconsumption" fill="#8b5cf6" radius={[0, 8, 8, 0]} name="Autokonsumpcja (%)" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {validReports.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Brak wystarczających danych do analizy.</p>
          <p className="text-sm text-gray-500 mt-2">Dodaj raporty z danymi produkcji energii, aby zobaczyć statystyki.</p>
        </div>
      )}
    </div>
  );
}