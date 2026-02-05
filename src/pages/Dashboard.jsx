import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
import { motion } from "framer-motion";

const modules = [
  { name: "Checklist", title: "Checklista", desc: "Analiza techniczna instalacji" },
  { name: "Interview", title: "Wywiad", desc: "Rozmowa z klientem" },
  { name: "AutoconsumptionCalc", title: "Autokonsumpcja", desc: "Kalkulator oszczędności" },
  { name: "PVCalculator", title: "Kalkulator PV", desc: "Dobór mocy instalacji" },
  { name: "Education", title: "Edukacja", desc: "Magazyn energii i autokonsumpcja" },
  { name: "VisitReports", title: "Raporty", desc: "Dokumentacja wizyt" }
];

export default function Dashboard() {
  return (
    <div className="space-y-8">
      <div className="text-center space-y-3 py-8">
        <div className="inline-flex items-center justify-center gap-2 mb-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center font-bold text-white text-lg">
            4E
          </div>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
          Doradca Techniczny 4-ECO
        </h1>
        <p className="text-gray-600 text-lg max-w-2xl mx-auto">
          Kompleksowe narzędzie do analizy instalacji fotowoltaicznych, doradztwa technicznego i raportowania wizyt
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ staggerChildren: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {modules.map((mod, i) => (
          <motion.div
            key={mod.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Link
              to={createPageUrl(mod.name)}
              className="block p-6 rounded-xl border-2 border-gray-200 hover:border-green-500 hover:shadow-lg transition-all bg-white"
            >
              <h3 className="text-lg font-bold text-gray-900 mb-2">{mod.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{mod.desc}</p>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}