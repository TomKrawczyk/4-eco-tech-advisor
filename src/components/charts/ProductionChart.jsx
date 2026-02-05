import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";

export default function ProductionChart({ production, exported, imported }) {
  const auto = production - exported;
  
  const data = [
    { name: "Produkcja PV", value: production, color: "#22c55e" },
    { name: "Autokonsumpcja", value: auto, color: "#16a34a" },
    { name: "Eksport do sieci", value: exported, color: "#86efac" },
    { name: "Import z sieci", value: imported || 0, color: "#f87171" }
  ].filter(item => item.value > 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-base font-semibold text-gray-900 mb-4">Bilans energetyczny [kWh/rok]</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 12 }} />
          <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
          <Tooltip 
            contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
            formatter={(value) => `${value} kWh`}
          />
          <Bar dataKey="value" radius={[8, 8, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}