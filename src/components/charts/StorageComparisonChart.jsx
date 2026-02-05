import React from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from "recharts";

export default function StorageComparisonChart() {
  // Przykładowy dzień - produkcja PV i zużycie
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  const data = hours.map(hour => {
    // Produkcja PV (gaussowska krzywa 6-18)
    let production = 0;
    if (hour >= 6 && hour <= 18) {
      const peak = 12;
      production = Math.exp(-Math.pow(hour - peak, 2) / 18) * 5;
    }
    
    // Zużycie (wyższe rano i wieczorem)
    const consumption = hour >= 6 && hour <= 9 ? 2.5 :
                       hour >= 17 && hour <= 22 ? 3 :
                       hour >= 10 && hour <= 16 ? 1.5 : 0.8;
    
    // Bez magazynu - import gdy produkcja < zużycie
    const withoutStorageImport = Math.max(0, consumption - production);
    const withoutStorageExport = Math.max(0, production - consumption);
    
    // Z magazynem - magazyn gromadzi nadwyżkę i oddaje wieczorem
    let storageLevel = 0;
    const withStorageImport = production >= consumption ? 0 : 
                              hour >= 17 && hour <= 22 ? 0 : // wieczorem używamy magazynu
                              Math.max(0, consumption - production);
    
    return {
      hour: `${hour}:00`,
      production: production.toFixed(2),
      consumption: consumption.toFixed(2),
      bezMagazynu: withoutStorageImport.toFixed(2),
      zMagazynem: withStorageImport.toFixed(2)
    };
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-base font-semibold text-gray-900 mb-2">Pobór energii z sieci - porównanie</h3>
      <p className="text-sm text-gray-600 mb-4">Import energii w ciągu dnia (kWh)</p>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="hour" tick={{ fill: '#6b7280', fontSize: 11 }} interval={2} />
          <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
          <Tooltip 
            contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
            formatter={(value) => `${value} kWh`}
          />
          <Legend />
          <Area 
            type="monotone" 
            dataKey="bezMagazynu" 
            stackId="1"
            stroke="#f87171" 
            fill="#fca5a5" 
            name="Bez magazynu"
          />
          <Area 
            type="monotone" 
            dataKey="zMagazynem" 
            stackId="2"
            stroke="#22c55e" 
            fill="#86efac" 
            name="Z magazynem"
          />
        </AreaChart>
      </ResponsiveContainer>
      
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="bg-red-50 rounded-lg p-3 border border-red-200">
          <div className="text-xs text-gray-600">Bez magazynu - import/dzień</div>
          <div className="text-lg font-bold text-red-600">~18 kWh</div>
        </div>
        <div className="bg-green-50 rounded-lg p-3 border border-green-200">
          <div className="text-xs text-gray-600">Z magazynem - import/dzień</div>
          <div className="text-lg font-bold text-green-600">~3 kWh</div>
        </div>
      </div>
    </div>
  );
}