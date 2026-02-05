import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "./utils";
import { motion, AnimatePresence } from "framer-motion";

const navItems = [
  { name: "Dashboard", label: "Start" },
  { name: "Checklist", label: "Checklista" },
  { name: "Interview", label: "Wywiad" },
  { name: "AutoconsumptionCalc", label: "Autokonsumpcja" },
  { name: "PVCalculator", label: "Kalkulator PV" },
  { name: "Education", label: "Edukacja" },
  { name: "VisitReports", label: "Raporty" },
  { name: "Analytics", label: "Analityka" },
];

export default function Layout({ children, currentPageName }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-500/10 via-emerald-50 to-green-500/10 text-gray-900">
      <style>{`
        * { -webkit-tap-highlight-color: transparent; }
        body { background: linear-gradient(135deg, #22c55e15 0%, #10b98120 25%, #ecfdf5 50%, #10b98120 75%, #22c55e15 100%); }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #ecfdf5; }
        ::-webkit-scrollbar-thumb { background: #22c55e; border-radius: 3px; }
      `}</style>

      {/* Top Navigation */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center font-bold text-white text-sm">
              4E
            </div>
            <div>
              <div className="text-base font-bold text-gray-900">4-ECO</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Green Energy</div>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = currentPageName === item.name;
              return (
                <Link
                  key={item.name}
                  to={createPageUrl(item.name)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-green-50 text-green-600"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100"
          >
            <div className="w-5 h-0.5 bg-gray-900 relative">
              <div className={`absolute w-5 h-0.5 bg-gray-900 transition-all ${mobileMenuOpen ? 'rotate-45 top-0' : '-top-1.5'}`}></div>
              <div className={`absolute w-5 h-0.5 bg-gray-900 transition-all ${mobileMenuOpen ? '-rotate-45 top-0' : 'top-1.5'}`}></div>
            </div>
          </button>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="fixed top-16 left-0 right-0 bg-white border-b border-gray-200 z-40 overflow-hidden md:hidden"
          >
            <nav className="p-4 space-y-1">
              {navItems.map((item) => {
                const isActive = currentPageName === item.name;
                return (
                  <Link
                    key={item.name}
                    to={createPageUrl(item.name)}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? "bg-green-50 text-green-600"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="pt-16">
        <div className="max-w-5xl mx-auto px-4 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}