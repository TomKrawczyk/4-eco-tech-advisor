import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

export default function AutoconsumptionPieChart({ production, exported }) {
  const auto = production - exported;
  const autoPct = ((auto / production) * 100).toFixed(1);
  const exportPct = ((exported / production) * 100).toFixed(1);

  const data = [
    { name: `Autokonsumpcja ${autoPct}%`, value: auto, color: "#16a34a" },
    { name: `Eksport ${exportPct}%`, value: exported, color: "#86efac" }
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-base font-semibold text-gray-900 mb-4">Podział produkcji</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name}`}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => `${value} kWh`} />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-4 text-center">
        <div className="text-3xl font-bold text-green-600">{autoPct}%</div>
        <div className="text-sm text-gray-600">autokonsumpcji</div>
      </div>
    </div>
  );
}