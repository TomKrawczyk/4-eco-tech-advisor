import React, { useState } from "react";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import CreditApplicationTab from "@/components/financing/CreditApplicationTab";
import BankContactsTab from "@/components/financing/BankContactsTab";
import FinancialMaterialsTab from "@/components/financing/FinancialMaterialsTab";

const tabs = [
  { key: "application", label: "Wniosek kredytowy" },
  { key: "contacts", label: "Opiekunowie bankowi" },
  { key: "materials", label: "Materiały finansowe" },
];

export default function Finansowanie() {
  const [activeTab, setActiveTab] = useState("application");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finansowanie"
        subtitle="Wniosek kredytowy, kontakty do opiekunów bankowych i najważniejsze materiały w jednym miejscu."
      />

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? "default" : "outline"}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === "application" && <CreditApplicationTab />}
      {activeTab === "contacts" && <BankContactsTab />}
      {activeTab === "materials" && <FinancialMaterialsTab />}
    </div>
  );
}