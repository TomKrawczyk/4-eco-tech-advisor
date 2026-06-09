import React from "react";
import { FileText } from "lucide-react";
import { financialMaterials } from "./financingData";

export default function FinancialMaterialsTab() {
  return (
    <div className="space-y-4">
      {financialMaterials.map((section) => (
        <div key={section.title} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-green-50 text-green-700 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{section.title}</h3>
          </div>
          <ul className="space-y-2 text-sm text-gray-700 leading-relaxed">
            {section.points.map((point) => (
              <li key={point} className="flex gap-2">
                <span className="text-green-600 font-bold">•</span>
                <span>
                  {point.includes("Kredytobiorca musi być nabywcą na umowie") ? (
                    <>
                      {point.split("Kredytobiorca musi być nabywcą na umowie").map((part, i) => (
                        <React.Fragment key={i}>
                          {i > 0 && <strong>Kredytobiorca musi być nabywcą na umowie</strong>}
                          {part}
                        </React.Fragment>
                      ))}
                    </>
                  ) : (
                    point
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}