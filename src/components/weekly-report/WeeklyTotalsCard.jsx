import React from "react";
import { Card, CardContent } from "@/components/ui/card";

export default function WeeklyTotalsCard({ label, value, icon: Icon, valueClassName = "text-white" }) {
  return (
    <Card className="border-slate-800 bg-slate-950 text-slate-100 shadow-lg shadow-black/20">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
            <div className={`mt-3 text-3xl font-bold ${valueClassName}`}>{value}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <Icon className="h-5 w-5 text-slate-300" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}