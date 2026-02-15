import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "./utils";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { ShieldAlert, User, LogOut, Shield } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import NotificationPanel from "@/components/notifications/NotificationPanel";

const navItems = [
  { name: "Dashboard", label: "Start" },
  { name: "Checklist", label: "Checklista" },
  { name: "Interview", label: "Wywiad" },
  { name: "AutoconsumptionCalc", label: "Autokonsumpcja" },
  { name: "PVCalculator", label: "Kalkulator PV" },
  { name: "ROICalculator", label: "Opłacalność" },
  { name: "Education", label: "Edukacja" },
  { name: "VisitReports", label: "Raporty" },
  { name: "Referrals", label: "Polecenia" },
  { name: "UserManagement", label: "Użytkownicy", adminOnly: true },
  { name: "UserActivityLog", label: "Historia aktywności", adminOnly: true },
];

export default function Layout({ children, currentPageName }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  React.useEffect(() => {
    const checkAccess = async () => {
      try {
        const user = await base44.auth.me();
        
        const allowedUsers = await base44.entities.AllowedUser.list();
        const userAccess = allowedUsers.find(allowed => 
          (allowed.data?.email || allowed.email) === user.email
        );
        
        if (userAccess) {
          // Ustawiamy dane z AllowedUser (sprawdzamy data.* lub bezpośrednio)
          user.role = userAccess.data?.role || userAccess.role;
          user.displayName = userAccess.data?.name || userAccess.name;
          setCurrentUser(user);
          setHasAccess(true);
          
          // Aktualizuj aktywność użytkownika
          base44.functions.invoke('trackUserActivity').catch(err => 
            console.error('Błąd śledzenia aktywności:', err)
          );
        } else {
          setCurrentUser(user);
          setHasAccess(false);
        }
      } catch (error) {
        console.error('Błąd sprawdzania dostępu:', error);
        setCurrentUser(null);
        setHasAccess(false);
      } finally {
        setCheckingAccess(false);
      }
    };

    checkAccess();
    
    // Okresowe odświeżanie aktywności co 5 minut
    const activityInterval = setInterval(() => {
      if (hasAccess) {
        base44.functions.invoke('trackUserActivity').catch(err => 
          console.error('Błąd śledzenia aktywności:', err)
        );
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(activityInterval);
  }, [hasAccess]);

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
              if (item.adminOnly && currentUser?.role !== "admin") return null;
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

          {/* User Menu */}
          <div className="flex items-center gap-2">
            {currentUser && (
              <>
                <NotificationPanel currentUser={currentUser} />
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                      <User className="w-4 h-4 text-green-600" />
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span className="font-medium">{currentUser.displayName}</span>
                      <span className="text-xs text-gray-500">{currentUser.email}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled>
                    <Shield className="w-4 h-4 mr-2" />
                    <span>
                      {currentUser.role === "admin" ? "Administrator" :
                       currentUser.role === "group_leader" ? "Group Leader" :
                       currentUser.role === "team_leader" ? "Team Leader" :
                       "Użytkownik"}
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <Link to={createPageUrl("UserProfile")}>
                    <DropdownMenuItem>
                      <User className="w-4 h-4 mr-2" />
                      <span>Mój profil</span>
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuItem onClick={() => base44.auth.logout()} className="text-red-600">
                    <LogOut className="w-4 h-4 mr-2" />
                    <span>Wyloguj się</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              </>
            )}

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
              {/* User Profile in Mobile Menu */}
              {currentUser && (
                <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-100">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 text-sm truncate">{currentUser.full_name}</div>
                      <div className="text-xs text-gray-600 truncate">{currentUser.email}</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 mb-3">
                    Witaj {currentUser.displayName}! 👋
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600 mb-3">
                    <Shield className="w-3.5 h-3.5" />
                    <span>
                      {currentUser.role === "admin" ? "Administrator" :
                       currentUser.role === "group_leader" ? "Group Leader" :
                       currentUser.role === "team_leader" ? "Team Leader" :
                       "Użytkownik"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Link to={createPageUrl("UserProfile")} onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="outline" size="sm" className="w-full">
                        <User className="w-4 h-4 mr-2" />
                        Mój profil
                      </Button>
                    </Link>
                    <Button
                      onClick={() => base44.auth.logout()}
                      variant="outline"
                      size="sm"
                      className="w-full text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Wyloguj się
                    </Button>
                  </div>
                </div>
              )}
              
              {navItems.map((item) => {
                if (item.adminOnly && currentUser?.role !== "admin") return null;
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
          {checkingAccess ? (
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
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
          ) : (
            children
          )}
        </div>
      </main>
    </div>
  );
}