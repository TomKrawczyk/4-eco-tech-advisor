import React from "react";
import { Landmark, FileText, Phone } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";

function InfoCard({ icon: Icon, title, description }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <div className="w-10 h-10 rounded-xl bg-green-50 text-green-700 flex items-center justify-center mb-4">
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
}

export default function Finansowanie() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Finansowanie"
        subtitle="Miejsce na interaktywny wniosek kredytowy oraz kontakty do opiekunów bankowych."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <InfoCard
          icon={FileText}
          title="Wniosek kredytowy"
          description="Tutaj dodamy interaktywny formularz wniosku kredytowego po otrzymaniu materiałów."
        />
        <InfoCard
          icon={Phone}
          title="Opiekunowie bankowi"
          description="W tej sekcji pojawią się numery telefonów i dane kontaktowe do opiekunów bankowych."
        />
        <InfoCard
          icon={Landmark}
          title="Materiały finansowe"
          description="Możemy tu też później dodać przydatne informacje, pliki i instrukcje dotyczące finansowania."
        />
      </div>

      <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Zakładka gotowa do uzupełnienia</h2>
        <p className="text-sm text-gray-600 max-w-2xl mx-auto leading-relaxed">
          Gdy prześlesz pliki, uzupełnię tę stronę o właściwy wniosek kredytowy i dane kontaktowe.
        </p>
      </div>
    </div>
  );
}