import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "./utils";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { ShieldAlert, User, LogOut, Shield, Menu, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import NotificationPanel from "@/components/notifications/NotificationPanel";
import RequiredTrainingGate from "@/components/training/RequiredTrainingGate";

// Dropdown dla desktop
function DesktopDropdown({ label, items, isGroupActive, currentPageName }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
          isGroupActive
            ? "bg-green-50 text-green-700 border border-green-200"
            : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
        }`}
      >
        {label}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[160px] py-1">
          {items.map(item => {
            const isActive = currentPageName === item.name;
            return (
              <Link
                key={item.name}
                to={createPageUrl(item.name)}
                onClick={() => setOpen(false)}
                className={`block px-4 py-2 text-xs font-medium transition-colors ${
                  isActive ? "bg-green-50 text-green-700" : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Struktura nawigacji: pojedyncze linki lub grupy z dropdown
const navStructure = [
  { name: "Dashboard", label: "Start" },
  { name: "Checklist", label: "Checklista" },
  { name: "Interview", label: "Wywiad" },
  { name: "AutoconsumptionCalc", label: "Autokonsumpcja" },
  {
    group: "Kalkulatory",
    items: [
      { name: "PVCalculator", label: "Kalkulator PV" },
      { name: "ROICalculator", label: "Opłacalność" },
    ]
  },
  { name: "Calendar", label: "Kalendarz" },
  { name: "Referrals", label: "Polecenia" },
  {
    group: "Raportowanie",
    items: [
      { name: "VisitReports", label: "Raporty wizytowe" },
      { name: "MeetingReports", label: "Raporty po spotkaniu" },
    ]
  },
  {
    group: "Umówione",
    items: [
      { name: "Meetings", label: "Spotkania" },
      { name: "PhoneContacts", label: "Kontakt telefoniczny" },
    ]
  },
  { name: "Education", label: "Szkolenia" },
  { name: "UserManagement", label: "Użytkownicy", adminOnly: true },
];

export default function Layout({ children, currentPageName }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [pendingRequiredTraining, setPendingRequiredTraining] = useState(null);

  React.useEffect(() => {
    const checkAccess = async () => {
      try {
        const user = await base44.auth.me();
        const allowedUsers = await base44.entities.AllowedUser.list();
        const userAccess = allowedUsers.find(allowed =>
          (allowed.data?.email || allowed.email) === user.email
        );
        if (userAccess) {
          user.role = userAccess.data?.role || userAccess.role;
          user.displayName = userAccess.data?.name || userAccess.name;
          setCurrentUser(user);
          setHasAccess(true);

          if (user.role !== 'admin') {
            const [trainings, views] = await Promise.all([
              base44.entities.Training.list('order'),
              base44.entities.TrainingView.filter({ user_email: user.email })
            ]);
            const completedIds = new Set(views.map(v => v.training_id));
            const requiredPending = trainings.find(t => t.is_required && t.is_published !== false && !completedIds.has(t.id));
            if (requiredPending) setPendingRequiredTraining(requiredPending);
          }

          base44.functions.invoke('trackUserActivity').catch(() => {});
        } else {
          setCurrentUser(user);
          setHasAccess(false);
        }
      } catch (error) {
        setCurrentUser(null);
        setHasAccess(false);
      } finally {
        setCheckingAccess(false);
      }
    };

    checkAccess();
    const activityInterval = setInterval(() => {
      if (hasAccess) base44.functions.invoke('trackUserActivity').catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(activityInterval);
  }, [hasAccess]);

  const isItemVisible = (item) => {
    if (item.adminOnly && currentUser?.role !== "admin") return false;
    if (item.roles && !item.roles.includes(currentUser?.role)) return false;
    return true;
  };

  const visibleNavItems = navStructure
    .map(entry => {
      if (entry.group) {
        // Jeśli cała grupa ma roles lub adminOnly, sprawdź czy user ma dostęp
        if (entry.adminOnly && currentUser?.role !== "admin") return null;
        if (entry.roles && !entry.roles.includes(currentUser?.role)) return null;
        const visibleItems = entry.items.filter(isItemVisible);
        if (visibleItems.length === 0) return null;
        return { ...entry, items: visibleItems };
      }
      return isItemVisible(entry) ? entry : null;
    })
    .filter(Boolean);

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
      <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 z-50 shadow-sm">
        <div className="h-full flex items-center justify-between px-3 md:px-4">
          {/* Logo */}
          <Link to={createPageUrl("Dashboard")} className="shrink-0">
            <img
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6985025012ef2a10cfdedf68/cfe2d3285_4-eco-logo.png"
              alt="4-ECO Green Energy"
              className="h-10 w-auto"
            />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-0.5 overflow-visible flex-1 mx-3 pr-2">
            {visibleNavItems.map((entry) => {
              if (entry.group) {
                const isGroupActive = entry.items.some(i => i.name === currentPageName);
                return (
                  <DesktopDropdown
                    key={entry.group}
                    label={entry.group}
                    items={entry.items}
                    isGroupActive={isGroupActive}
                    currentPageName={currentPageName}
                  />
                );
              }
              const isActive = currentPageName === entry.name;
              return (
                <Link
                  key={entry.name}
                  to={createPageUrl(entry.name)}
                  className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                    isActive
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  {entry.label}
                </Link>
              );
            })}
          </nav>

          {/* Right side: notifications + user + hamburger */}
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {currentUser && (
              <>
                <NotificationPanel currentUser={currentUser} />
                {/* User info on desktop */}
                <div className="hidden md:flex items-center gap-2 ml-1">
                  <Link to={createPageUrl("UserProfile")} className="text-right hover:opacity-75 transition-opacity">
                    <div className="text-xs font-semibold text-gray-800 leading-tight">{currentUser.displayName}</div>
                    <div className="text-[10px] text-gray-400 leading-tight">
                      {currentUser.role === "admin" ? "Administrator" :
                       currentUser.role === "group_leader" ? "Group Leader" :
                       currentUser.role === "team_leader" ? "Team Leader" : "Użytkownik"}
                    </div>
                  </Link>
                  <button
                    onClick={() => base44.auth.logout()}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                    title="Wyloguj"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}

            {/* Hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-gray-700" /> : <Menu className="w-5 h-5 text-gray-700" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu — full screen overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-40 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            {/* Drawer from right */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.25 }}
              className="fixed top-0 right-0 bottom-0 w-72 bg-white z-50 md:hidden flex flex-col shadow-2xl"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <img
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6985025012ef2a10cfdedf68/cfe2d3285_4-eco-logo.png"
                  alt="4-ECO"
                  className="h-8 w-auto"
                />
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-gray-100"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              {/* User info */}
              {currentUser && (
                <div className="px-4 py-3 bg-green-50 border-b border-green-100">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-green-600 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 text-sm truncate">{currentUser.displayName}</div>
                      <div className="text-[11px] text-gray-500 truncate">{currentUser.email}</div>
                      <div className="text-[11px] text-green-700 flex items-center gap-1 mt-0.5">
                        <Shield className="w-3 h-3" />
                        {currentUser.role === "admin" ? "Administrator" :
                         currentUser.role === "group_leader" ? "Group Leader" :
                         currentUser.role === "team_leader" ? "Team Leader" : "Użytkownik"}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Nav links — scrollable */}
              <nav className="flex-1 overflow-y-auto py-2 px-2">
                {visibleNavItems.map((entry) => {
                  if (entry.group) {
                    return (
                      <div key={entry.group} className="mb-1">
                        <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                          {entry.group}
                        </div>
                        {entry.items.map(item => {
                          const isActive = currentPageName === item.name;
                          return (
                            <Link
                              key={item.name}
                              to={createPageUrl(item.name)}
                              onClick={() => setMobileMenuOpen(false)}
                              className={`flex items-center pl-5 pr-3 py-2 rounded-lg text-sm font-medium mb-0.5 transition-all ${
                                isActive
                                  ? "bg-green-50 text-green-700 border border-green-200"
                                  : "text-gray-700 hover:bg-gray-50"
                              }`}
                            >
                              {item.label}
                            </Link>
                          );
                        })}
                      </div>
                    );
                  }
                  const isActive = currentPageName === entry.name;
                  return (
                    <Link
                      key={entry.name}
                      to={createPageUrl(entry.name)}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium mb-0.5 transition-all ${
                        isActive
                          ? "bg-green-50 text-green-700 border border-green-200"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {entry.label}
                    </Link>
                  );
                })}
              </nav>

              {/* Footer actions */}
              <div className="px-3 py-3 border-t border-gray-100 space-y-1">
                <Link to={createPageUrl("UserProfile")} onClick={() => setMobileMenuOpen(false)}>
                  <button className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                    <User className="w-4 h-4" />
                    Mój profil
                  </button>
                </Link>
                <button
                  onClick={() => base44.auth.logout()}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Wyloguj się
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="pt-14">
        <div className="max-w-5xl mx-auto px-3 md:px-4 py-6 md:py-8">
          {checkingAccess ? (
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-gray-600 mt-4">Sprawdzanie dostępu...</p>
              </div>
            </div>
          ) : !hasAccess && currentUser ? (
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center max-w-md mx-auto">
                <ShieldAlert className="w-16 h-16 text-red-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Brak dostępu</h2>
                <p className="text-gray-600 mb-2">Twoje konto ({currentUser?.email}) nie ma uprawnień do tej aplikacji.</p>
                <p className="text-sm text-gray-500 mb-6">Skontaktuj się z administratorem, aby uzyskać dostęp.</p>
                <button
                  onClick={() => base44.auth.logout()}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Wyloguj się
                </button>
              </div>
            </div>
          ) : pendingRequiredTraining ? (
            <RequiredTrainingGate
              training={pendingRequiredTraining}
              currentUser={currentUser}
              onCompleted={() => setPendingRequiredTraining(null)}
            />
          ) : (
            children
          )}
        </div>
      </main>
    </div>
  );
}