import React from "react";
import { Card, CardContent } from "@/components/ui/card";

export default function WeeklyTotalsCard({ label, value, icon: Icon, valueClassName = "text-green-700" }) {
  return (
    <Card className="rounded-xl border border-gray-200 bg-white text-slate-800 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">{label}</p>
            <div className={`mt-3 text-3xl font-bold ${valueClassName}`}>{value}</div>
          </div>
          <div className="rounded-xl border border-green-100 bg-green-50 p-3">
            <Icon className="h-5 w-5 text-green-600" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}