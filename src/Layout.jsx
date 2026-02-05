import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "./utils";
import {
  Home,
  ClipboardCheck,
  MessageSquare,
  Calculator,
  GraduationCap,
  FileText,
  Menu,
  X,
  Sun,
  Zap,
  Leaf
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const navItems = [
  { name: "Dashboard", icon: Home, label: "Start" },
  { name: "Checklist", icon: ClipboardCheck, label: "Checklista" },
  { name: "Interview", icon: MessageSquare, label: "Wywiad" },
  { name: "AutoconsumptionCalc", icon: Calculator, label: "Autokons." },
  { name: "PVCalculator", icon: Sun, label: "Kalk. PV" },
  { name: "Education", icon: GraduationCap, label: "Edukacja" },
  { name: "VisitReports", icon: FileText, label: "Raporty" },
];

export default function Layout({ children, currentPageName }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white">
      <style>{`
        :root {
          --eco-green: #22c55e;
          --eco-green-light: #4ade80;
          --eco-dark: #0a0f1a;
          --eco-card: rgba(255,255,255,0.04);
          --eco-border: rgba(74,222,128,0.15);
        }
        * { -webkit-tap-highlight-color: transparent; }
        body { background: #0a0f1a; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0a0f1a; }
        ::-webkit-scrollbar-thumb { background: #22c55e33; border-radius: 3px; }
        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .mobile-bottom-nav { display: flex !important; }
        }
        @media (min-width: 769px) {
          .mobile-bottom-nav { display: none !important; }
          .mobile-header-bar { display: none !important; }
        }
      `}</style>

      {/* Desktop Sidebar */}
      <aside className="desktop-sidebar fixed left-0 top-0 bottom-0 w-[220px] bg-[#0d1322] border-r border-[rgba(74,222,128,0.1)] z-40 flex flex-col">
        <div className="p-5 border-b border-[rgba(74,222,128,0.1)]">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-green-400 tracking-wide">4-ECO</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-widest">Green Energy</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = currentPageName === item.name;
            return (
              <Link
                key={item.name}
                to={createPageUrl(item.name)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-green-500/15 text-green-400"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <item.icon className={`w-[18px] h-[18px] ${isActive ? "text-green-400" : ""}`} />
                <span>{item.label}</span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-green-400" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[rgba(74,222,128,0.1)]">
          <div className="text-[10px] text-gray-600 text-center">
            Doradca Techniczny v2.0
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="mobile-header-bar fixed top-0 left-0 right-0 h-14 bg-[#0d1322]/95 backdrop-blur-xl border-b border-[rgba(74,222,128,0.1)] z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-bold text-green-400">4-ECO</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Full Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 top-14 bg-[#0d1322]/98 backdrop-blur-xl z-40 p-4"
          >
            <nav className="space-y-2">
              {navItems.map((item) => {
                const isActive = currentPageName === item.name;
                return (
                  <Link
                    key={item.name}
                    to={createPageUrl(item.name)}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-4 px-5 py-4 rounded-2xl text-base font-medium transition-all ${
                      isActive
                        ? "bg-green-500/15 text-green-400"
                        : "text-gray-300 hover:bg-white/5"
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-bottom-nav fixed bottom-0 left-0 right-0 h-16 bg-[#0d1322]/95 backdrop-blur-xl border-t border-[rgba(74,222,128,0.1)] z-50 items-center justify-around px-1 pb-[env(safe-area-inset-bottom)]">
        {navItems.slice(0, 5).map((item) => {
          const isActive = currentPageName === item.name;
          return (
            <Link
              key={item.name}
              to={createPageUrl(item.name)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-xl transition-all ${
                isActive ? "text-green-400" : "text-gray-500"
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? "text-green-400" : ""}`} />
              <span className="text-[10px] font-medium leading-tight">{item.label}</span>
            </Link>
          );
        })}
        <Link
          to={createPageUrl("VisitReports")}
          className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-xl transition-all ${
            currentPageName === "VisitReports" ? "text-green-400" : "text-gray-500"
          }`}
        >
          <FileText className={`w-5 h-5 ${currentPageName === "VisitReports" ? "text-green-400" : ""}`} />
          <span className="text-[10px] font-medium leading-tight">Raporty</span>
        </Link>
      </nav>

      {/* Main Content */}
      <main className="md:ml-[220px] pt-14 md:pt-0 pb-20 md:pb-6">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}