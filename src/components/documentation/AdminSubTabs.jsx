import React, { useState } from "react";
import { EyeOff } from "lucide-react";
import HiddenLeads from "@/pages/HiddenLeads";

const SUB_TABS = [
  { key: "hidden_leads", label: "Ukryte kontakty", icon: EyeOff },
];

export default function AdminSubTabs() {
  const [active, setActive] = useState("hidden_leads");

  return (
    <div>
      <div className="flex gap-2 mb-5 flex-wrap">
        {SUB_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              active === tab.key
                ? "bg-green-50 text-green-700 border border-green-300"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>
      {active === "hidden_leads" && <HiddenLeads />}
    </div>
  );
}