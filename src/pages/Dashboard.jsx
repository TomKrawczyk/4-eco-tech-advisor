import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
import { motion } from "framer-motion";
import {
  ClipboardCheck,
  MessageSquare,
  Calculator,
  Sun,
  GraduationCap,
  FileText,
  Leaf,
  ArrowRight,
  Zap,
  Battery,
  Thermometer
} from "lucide-react";

const modules = [
  {
    name: "Checklist",
    icon: ClipboardCheck,
    title: "Checklista",
    desc: "Podstawowe zadania doradcy technicznego",
    color: "from-green-500 to-emerald-600",
    bg: "bg-green-500/10",
    border: "border-green-500/20"
  },
  {
    name: "Interview",
    icon: MessageSquare,
    title: "Wywiad",
    desc: "Rozmowa z klientem / analiza potrzeb",
    color: "from-blue-500 to-cyan-600",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20"
  },
  {
    name: "AutoconsumptionCalc",
    icon: Calculator,
    title: "Kalkulator Autokonsumpcji",
    desc: "Oblicz opłacalność zużycia własnego",
    color: "from-amber-500 to-orange-600",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20"
  },
  {
    name: "PVCalculator",
    icon: Sun,
    title: "Kalkulator PV",
    desc: "Dobierz moc instalacji i sprawdź zysk",
    color: "from-yellow-500 to-amber-600",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/20"
  },
  {
    name: "Education",
    icon: GraduationCap,
    title: "Edukacja",
    desc: "Fotowoltaika, pompy ciepła, magazyny energii",
    color: "from-purple-500 to-violet-600",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20"
  },
  {
    name: "VisitReports",
    icon: FileText,
    title: "Raporty wizyt",
    desc: "Dokumentacja i raportowanie wizyt u klienta",
    color: "from-rose-500 to-pink-600",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20"
  }
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export default function Dashboard() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0d1a0d] to-[#0a1628] border border-green-500/10 p-6 md:p-10"
      >
        <div className="absolute top-0 right-0 w-72 h-72 bg-green-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-green-500/5 rounded-full blur-2xl translate-y-1/3 -translate-x-1/4" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg shadow-green-500/20">
              <Leaf className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">
                Doradca Techniczny
              </h1>
              <p className="text-green-400/80 text-sm font-medium tracking-wide">
                4-ECO GREEN ENERGY
              </p>
            </div>
          </div>
          <p className="text-gray-400 text-sm md:text-base max-w-xl leading-relaxed">
            Kompleksowe narzędzie do analizy instalacji OZE, doradztwa technicznego 
            i raportowania wizyt u klientów.
          </p>

          <div className="flex flex-wrap gap-3 mt-6">
            {[
              { icon: Sun, label: "Fotowoltaika" },
              { icon: Thermometer, label: "Pompy ciepła" },
              { icon: Battery, label: "Magazyny energii" },
              { icon: Zap, label: "Autokonsumpcja" },
            ].map((tag) => (
              <div key={tag.label} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-gray-300">
                <tag.icon className="w-3.5 h-3.5 text-green-400" />
                {tag.label}
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Module Grid */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {modules.map((mod) => (
          <motion.div key={mod.name} variants={item}>
            <Link
              to={createPageUrl(mod.name)}
              className={`group block p-5 rounded-2xl border ${mod.border} ${mod.bg} hover:scale-[1.02] transition-all duration-300 active:scale-[0.98]`}
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${mod.color} flex items-center justify-center mb-4 shadow-lg group-hover:shadow-xl transition-shadow`}>
                <mod.icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-white font-semibold text-base mb-1">{mod.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{mod.desc}</p>
              <div className="flex items-center gap-1 mt-3 text-green-400 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                Otwórz <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}