import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  BookOpen, Users, FileText, Calendar, Calculator, 
  Settings, Database, ChevronDown, ChevronRight, 
  Shield, Zap, Bell, Download, Phone, Star, Wrench, BarChart3
} from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";


const Section = ({ title, icon: Icon, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-50 rounded-lg">
            <Icon className="w-4 h-4 text-green-600" />
          </div>
          <span className="font-semibold text-gray-900">{title}</span>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-2 bg-white border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  );
};

const Table = ({ headers, rows }) => (
  <div className="overflow-x-auto mt-3">
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="bg-gray-50">
          {headers.map(h => (
            <th key={h} className="text-left px-3 py-2 border border-gray-200 font-semibold text-gray-700 text-xs uppercase tracking-wide">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="hover:bg-gray-50">
            {row.map((cell, j) => (
              <td key={j} className="px-3 py-2 border border-gray-200 text-gray-700 align-top">{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Code = ({ children }) => (
  <code className="bg-gray-100 text-green-700 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
);

const Pill = ({ children, color = "gray" }) => {
  const colors = {
    green: "bg-green-100 text-green-700",
    blue: "bg-blue-100 text-blue-700",
    purple: "bg-purple-100 text-purple-700",
    orange: "bg-orange-100 text-orange-700",
    red: "bg-red-100 text-red-700",
    gray: "bg-gray-100 text-gray-700",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors[color]}`}>{children}</span>
  );
};

function generateDocHTML(tab) {
  const content = document.getElementById("doc-content")?.innerHTML || "";
  return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Dokumentacja 4-ECO Green Energy</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 900px; margin: 0 auto; padding: 32px 24px; color: #111; line-height: 1.6; }
  h1 { font-size: 28px; font-weight: 700; margin-bottom: 4px; }
  h2 { font-size: 20px; font-weight: 700; margin: 28px 0 8px; color: #166534; border-bottom: 2px solid #d1fae5; padding-bottom: 6px; }
  h3 { font-size: 16px; font-weight: 600; margin: 20px 0 6px; }
  p, li { font-size: 14px; color: #374151; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
  th { background: #f9fafb; text-align: left; padding: 8px 10px; border: 1px solid #e5e7eb; font-weight: 600; font-size: 11px; text-transform: uppercase; color: #6b7280; }
  td { padding: 8px 10px; border: 1px solid #e5e7eb; vertical-align: top; }
  tr:hover td { background: #f9fafb; }
  code { background: #f3f4f6; color: #15803d; padding: 2px 5px; border-radius: 4px; font-size: 12px; font-family: monospace; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
  .badge-green { background: #dcfce7; color: #166534; }
  .badge-blue { background: #dbeafe; color: #1e40af; }
  .badge-gray { background: #f3f4f6; color: #374151; }
  .section { margin-bottom: 28px; }
  .intro { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; }
  .note { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 10px 14px; font-size: 13px; color: #92400e; margin-top: 10px; }
  footer { margin-top: 48px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 16px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
${content}
<footer>Dokumentacja wygenerowana automatycznie · 4-ECO Green Energy · ${new Date().toLocaleDateString("pl-PL")}</footer>
</body>
</html>`;
}

function handleDownload(tab) {
  const html = generateDocHTML(tab);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dokumentacja_4eco_${tab}_${new Date().toISOString().split("T")[0]}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Documentation() {
  const [activeTab, setActiveTab] = useState("general");

  return (
    <div>
      <PageHeader
        title="Dokumentacja aplikacji"
        subtitle="4-ECO Green Energy — przewodnik ogólny i techniczny"
      />

      {/* Tab switcher + download */}
      <div className="flex items-center justify-between gap-2 mb-6 flex-wrap">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("general")}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "general"
                ? "bg-green-600 text-white shadow"
                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
          >
            📘 Ogólna
          </button>
          <button
            onClick={() => setActiveTab("technical")}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "technical"
                ? "bg-green-600 text-white shadow"
                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
          >
            ⚙️ Techniczna
          </button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleDownload(activeTab)}
          className="flex items-center gap-2 border-green-200 text-green-700 hover:bg-green-50"
        >
          <Download className="w-4 h-4" />
          Pobierz HTML
        </Button>
      </div>

      <div id="doc-content">
      {/* ===================== DOKUMENTACJA OGÓLNA ===================== */}
      {activeTab === "general" && (
        <div>
          {/* Intro */}
          <Card className="border-0 shadow-sm mb-6 bg-gradient-to-r from-green-50 to-emerald-50">
            <CardContent className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-2">O aplikacji</h2>
              <p className="text-sm text-gray-700 leading-relaxed">
                <strong>4-ECO Green Energy</strong> to wewnętrzna aplikacja CRM/operacyjna dla doradców i menedżerów firmy 4-ECO.
                Służy do zarządzania spotkaniami, wizytami, raportami technicznymi (PV, pompy ciepła, magazyny energii),
                kontaktami telefonicznymi oraz edukacją wewnętrzną. Integruje się z Google Sheets w celu automatycznego
                pobierania leadów i harmonogramów spotkań.
              </p>
            </CardContent>
          </Card>

          {/* Role i uprawnienia */}
          <Section title="Role użytkowników i uprawnienia" icon={Users} defaultOpen>
            <p className="text-sm text-gray-600 mb-3">System posiada 8 ról z różnymi poziomami dostępu:</p>
            <Table
              headers={["Rola", "Opis", "Dostęp"]}
              rows={[
                ["Administrator", "Pełny dostęp do wszystkich funkcji i danych", <Pill color="red">Pełny</Pill>],
                ["Group Leader", "Zarządza grupami doradców, widzi spotkania i raporty swojej grupy", <Pill color="orange">Grupowy</Pill>],
                ["Team Leader", "Zarządza zespołem doradców, przypisuje spotkania", <Pill color="purple">Zespołowy</Pill>],
                ["Doradca (Advisor)", "Podstawowa rola — pracuje ze spotkaniami, wizytami i raportami", <Pill color="blue">Własny</Pill>],
                ["Serwisant", "Dostęp do raportów serwisowych (PC/PV)", <Pill color="green">Serwis</Pill>],
                ["Audytor", "Dostęp tylko do odczytu, przegląd raportów", <Pill color="gray">Odczyt</Pill>],
                ["Administrator HR", "Zarządzanie użytkownikami bez dostępu do raportów operacyjnych", <Pill color="blue">HR</Pill>],
                ["Użytkownik testowy", "Dostęp tylko do Szkolenia i Start", <Pill color="gray">Test</Pill>],
              ]}
            />
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <strong>Blokada konta:</strong> Doradcy mogą zostać automatycznie zablokowani za brak raportów. Admin może ręcznie ustawić datę blokady (<Code>blocked_until</Code>) lub odblokować konto jednym kliknięciem.
            </div>
          </Section>

          {/* Moduły */}
          <Section title="Moduły aplikacji" icon={Zap}>
            <div className="space-y-4">
              {[
                {
                  icon: "📅",
                  name: "Kalendarz",
                  path: "/Calendar",
                  desc: "Osobisty kalendarz wydarzeń. Widok własnych, zespołowych i grupowych spotkań. Obsługa statusów (zaplanowane, ukończone, odroczone, anulowane). Synchronizacja z MeetingAssignments z Google Sheets.",
                },
                {
                  icon: "🤝",
                  name: "Spotkania (Meetings)",
                  path: "/Meetings",
                  desc: "Lista spotkań przypisanych do doradcy lub grupy, pobranych z Google Sheets. Mechanizm przyjęcia/odrzucenia spotkania, pula odrzuconych, powiadomienia do liderów.",
                },
                {
                  icon: "📞",
                  name: "Kontakty telefoniczne (PhoneContacts)",
                  path: "/PhoneContacts",
                  desc: "Kontakty z arkusza DWS wymagające działania telefonicznego. Możliwość tworzenia raportów z kontaktu, prowadzenia wywiadu energetycznego.",
                },
                {
                  icon: "📝",
                  name: "Raport wizytowy (VisitReports)",
                  path: "/VisitReports",
                  desc: "Formularz raportu wizyty u klienta z instalacją PV. Zawiera: stan techniczny (panele, mocowania, okablowanie, falownik), dane energetyczne, wywiad i podpis klienta.",
                },
                {
                  icon: "🤝",
                  name: "Raport po spotkaniu (MeetingReports)",
                  path: "/MeetingReports",
                  desc: "Raport doradcy po spotkaniu sprzedażowym. Klient, data, opis, kolejne kroki, zdjęcia. Statusy: zaplanowane / ukończone / anulowane.",
                },
                {
                  icon: "🔧",
                  name: "Raport serwisowy (ServiceReports)",
                  path: "/ServiceReports",
                  desc: "Protokoły serwisowe PC (czyszczenie) i PV (przegląd). Pola formularza dynamiczne wg typu protokołu. Podpisy pracownika i klienta.",
                },
                {
                  icon: "✅",
                  name: "Checklista",
                  path: "/Checklist",
                  desc: "Interaktywna lista kontrolna technika na wizycie. Pozycje do odhaczenia, eksport PDF.",
                },
                {
                  icon: "💬",
                  name: "Wywiad energetyczny",
                  path: "/Interview",
                  desc: "Formularz wywiadu z klientem zbierający dane o zużyciu energii, grafiku dnia, urządzeniach. Eksport PDF.",
                },
                {
                  icon: "☀️",
                  name: "Kalkulator PV",
                  path: "/PVCalculator",
                  desc: "Obliczanie optymalnej wielkości instalacji fotowoltaicznej na podstawie zużycia i parametrów dachu. Generowanie oferty PDF.",
                },
                {
                  icon: "📈",
                  name: "Kalkulator ROI",
                  path: "/ROICalculator",
                  desc: "Analiza zwrotu z inwestycji w PV. Uwzględnia prognozowane ceny energii, dofinansowania, oszczędności.",
                },
                {
                  icon: "⚡",
                  name: "Kalkulator autokonsumpcji",
                  path: "/AutoconsumptionCalc",
                  desc: "Obliczanie wskaźnika autokonsumpcji instalacji PV.",
                },
                {
                  icon: "🎓",
                  name: "Szkolenia (Education)",
                  path: "/Education",
                  desc: "Biblioteka materiałów szkoleniowych (wideo, PDF). Oznaczanie ukończenia. Szkolenia obowiązkowe blokują dostęp do pozostałych modułów.",
                },
                {
                  icon: "👥",
                  name: "Polecenia (Referrals)",
                  path: "/Referrals",
                  desc: "Zarządzanie poleceniami klientów. Statusy: nowe / skontaktowane / umówione / ukończone / odrzucone.",
                },
                {
                  icon: "⚙️",
                  name: "Zarządzanie użytkownikami",
                  path: "/UserManagement",
                  desc: "Panel administratora: dodawanie/edycja użytkowników, grupy, prośby rejestracyjne, logi aktywności, podgląd profili.",
                },
              ].map(m => (
                <div key={m.name} className="flex gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200">
                  <span className="text-2xl leading-none mt-0.5">{m.icon}</span>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-gray-900">{m.name}</span>
                      <Code>{m.path}</Code>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{m.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Przepływ pracy */}
          <Section title="Typowy przepływ pracy doradcy" icon={Star}>
            <ol className="space-y-3 text-sm text-gray-700">
              {[
                "Doradca loguje się do aplikacji — system sprawdza dostęp w tabeli AllowedUser.",
                "Jeśli są nieukończone szkolenia obowiązkowe → ekran blokady z materiałem do obejrzenia.",
                "Po zalogowaniu: widok panelu Start z aktywnymi spotkaniami i ostatnimi raportami.",
                "Wejście do Spotkania → lista przypisanych spotkań z Google Sheets → Przyjmij / Odrzuć.",
                "Po przyjęciu spotkanie pojawia się w Kalendarzu.",
                "Po odbyciu spotkania → tworzenie Raportu po spotkaniu (MeetingReport).",
                "Wizyta serwisowa lub techniczna → tworzenie Raportu wizytowego lub Raportu serwisowego.",
                "Brak raportu w wymaganym terminie → system automatycznie blokuje konto.",
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold shrink-0">{i+1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </Section>

          {/* Powiadomienia */}
          <Section title="System powiadomień" icon={Bell}>
            <p className="text-sm text-gray-600 mb-3">Powiadomienia in-app (dzwonek w nawigacji) i email (przez Brevo).</p>
            <Table
              headers={["Zdarzenie", "Odbiorca", "Typ"]}
              rows={[
                ["Nowe spotkanie przypisane", "Doradca", "In-app + Email"],
                ["Nowy kontakt telefoniczny przypisany", "Doradca", "In-app + Email"],
                ["Spotkanie odrzucone (2+)", "Lider grupy", "In-app"],
                ["Prośba o dostęp", "Administrator", "In-app"],
                ["Nowy raport stworzony", "Lider (wg ustawień)", "In-app + Email"],
                ["Inaktywne polecenie (7+ dni)", "Odpowiedzialny", "In-app"],
              ]}
            />
            <p className="text-xs text-gray-500 mt-3">Każdy użytkownik może skonfigurować preferencje powiadomień w swoim profilu (<Code>/NotificationSettings</Code>).</p>
          </Section>

          {/* Eksport danych */}
          <Section title="Eksport danych" icon={Download}>
            <div className="space-y-3 text-sm text-gray-700">
              <div className="p-3 border rounded-lg">
                <strong>Excel (XLSX)</strong> — eksport wszystkich raportów (spotkania, wizyty, serwis) do wieloarkuszowego pliku Excel. Dostępny w menu Raportowanie → Eksport danych (tylko admin).
              </div>
              <div className="p-3 border rounded-lg">
                <strong>PDF</strong> — każdy raport (wizytowy, serwisowy, checklista, wywiad, kalkulator) można wyeksportować do PDF bezpośrednio z widoku raportu.
              </div>
              <div className="p-3 border rounded-lg">
                <strong>ZIP ze zdjęciami</strong> — wszystkie zdjęcia z raportów można pobrać jako archiwum ZIP (admin, strona Eksport danych).
              </div>
              <div className="p-3 border rounded-lg">
                <strong>Email</strong> — raporty wizytowe można wysłać bezpośrednio na email klienta przez Brevo.
              </div>
            </div>
          </Section>

          {/* Google Sheets */}
          <Section title="Integracja z Google Sheets" icon={FileText}>
            <p className="text-sm text-gray-600 mb-3">
              Aplikacja automatycznie pobiera dane z arkusza Google Sheets (DWS) co godzinę lub na żądanie admina.
              Każda zakładka arkusza odpowiada grupie/rynkowi.
            </p>
            <ul className="text-sm text-gray-700 space-y-2">
              <li>✅ Automatyczne rozpoznawanie nagłówków kolumn (imię, telefon, adres, data, agent, status)</li>
              <li>✅ Podział na <strong>Spotkania</strong> (status = "Spotkanie") i <strong>Kontakty DWS</strong> (status zawiera "kontakt" / "DWS")</li>
              <li>✅ Mapowanie arkuszy na grupy (SheetGroupMapping)</li>
              <li>✅ Możliwość wyłączenia konkretnych zakładek (<Code>is_active = false</Code>)</li>
              <li>✅ Wywiad energetyczny automatycznie wypełniany z danych arkusza</li>
            </ul>
          </Section>
        </div>
      )}

      {/* ===================== DOKUMENTACJA TECHNICZNA ===================== */}
      {activeTab === "technical" && (
        <div>
          {/* Stack */}
          <Card className="border-0 shadow-sm mb-6 bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardContent className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-3">Stack technologiczny</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Frontend", value: "React 18 + Vite" },
                  { label: "Styling", value: "Tailwind CSS + shadcn/ui" },
                  { label: "State", value: "TanStack Query v5" },
                  { label: "Routing", value: "React Router v6 (Hash)" },
                  { label: "Backend", value: "Base44 BaaS" },
                  { label: "Functions", value: "Deno Deploy" },
                  { label: "Database", value: "Base44 Entity Store" },
                  { label: "Auth", value: "Base44 Auth" },
                ].map(item => (
                  <div key={item.label} className="bg-white rounded-lg p-3 border border-blue-100">
                    <div className="text-xs font-semibold text-gray-500 uppercase">{item.label}</div>
                    <div className="text-sm font-medium text-gray-900 mt-0.5">{item.value}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Architektura */}
          <Section title="Architektura aplikacji" icon={Database} defaultOpen>
            <div className="text-sm text-gray-700 space-y-3">
              <p>Aplikacja działa w architekturze <strong>SPA (Single Page Application)</strong> z backendem jako usługą (BaaS) Base44.</p>
              <div className="bg-gray-50 rounded-lg p-4 font-mono text-xs space-y-1 text-gray-700">
                <div>📁 <strong>src/</strong></div>
                <div className="pl-4">📁 <strong>pages/</strong> — strony (React components)</div>
                <div className="pl-4">📁 <strong>components/</strong> — współdzielone komponenty UI</div>
                <div className="pl-4">📁 <strong>entities/</strong> — schematy JSON encji bazy danych</div>
                <div className="pl-4">📁 <strong>functions/</strong> — funkcje backend (Deno)</div>
                <div className="pl-4">📁 <strong>lib/</strong> — utilsy, klient query, auth context</div>
                <div className="pl-4">📁 <strong>api/</strong> — inicjalizacja Base44 SDK</div>
                <div className="pl-4">📄 <strong>App.jsx</strong> — router + layout wrapper</div>
                <div className="pl-4">📄 <strong>index.css</strong> — design tokens (CSS variables)</div>
                <div className="pl-4">📄 <strong>tailwind.config.js</strong> — konfiguracja Tailwind</div>
              </div>
              <p>Routing oparty na <Code>HashRouter</Code> — trasy jako <Code>#/PageName</Code>. Każda strona musi być zadeklarowana jako osobny <Code>&lt;Route&gt;</Code> w <Code>App.jsx</Code>.</p>
            </div>
          </Section>

          {/* Encje */}
          <Section title="Model danych (Encje)" icon={Database}>
            <p className="text-sm text-gray-600 mb-3">Wszystkie dane są przechowywane w Base44 Entity Store. Każda encja ma automatyczne pola: <Code>id</Code>, <Code>created_date</Code>, <Code>updated_date</Code>, <Code>created_by</Code>.</p>
            <Table
              headers={["Encja", "Opis", "Kluczowe pola"]}
              rows={[
                ["AllowedUser", "Lista użytkowników z dostępem i ich role", "email, name, role, is_blocked, blocked_until, group_id, assigned_to"],
                ["Group", "Grupy sprzedażowe", "name, group_leader_ids[]"],
                ["MeetingAssignment", "Spotkania z Google Sheets przypisane doradcom", "meeting_key, client_name, assigned_user_email, meeting_date"],
                ["MeetingAcceptance", "Status przyjęcia/odrzucenia spotkania", "meeting_assignment_id, status, rejection_reason, rejection_count"],
                ["CalendarEvent", "Zdarzenia kalendarza użytkownika", "title, event_date, event_time, owner_email, status, source"],
                ["PhoneContact", "Kontakty telefoniczne z arkusza", "contact_key, sheet, client_name, assigned_user_email"],
                ["VisitReport", "Raporty z wizyt technicznych PV", "client_name, visit_date, status, author_email, photos[]"],
                ["MeetingReport", "Raporty po spotkaniach sprzedażowych", "client_name, meeting_date, status, author_email, photos[]"],
                ["ServiceReport", "Protokoły serwisowe PC/PV", "client_name, service_date, report_type, fields{}, status"],
                ["PhoneContactReport", "Raporty z kontaktów telefonicznych", "contact_key, client_name, result, description"],
                ["Training", "Materiały szkoleniowe", "title, video_url, document_url, is_required, is_published"],
                ["TrainingView", "Śledzenie ukończenia szkoleń", "training_id, user_email, completed"],
                ["Referral", "Polecenia klientów", "client_name, client_phone, status, assigned_to"],
                ["Notification", "Powiadomienia in-app", "user_email, type, title, message, is_read"],
                ["NotificationPreference", "Ustawienia powiadomień", "user_email, new_report_in_app, new_report_email"],
                ["ActivityLog", "Logi aktywności użytkowników", "user_email, action_type, page_name, details"],
                ["RegistrationRequest", "Prośby o dostęp od nowych użytkowników", "email, full_name, status"],
                ["HiddenMeeting", "Ukryte spotkania (admin)", "meeting_key, hidden_by"],
                ["SheetGroupMapping", "Mapowanie zakładek arkusza na grupy", "sheet_name, group_id, is_active"],
                ["Component", "Komponenty instalacji PV (baza produktowa)", "type, manufacturer, model, power"],
              ]}
            />
          </Section>

          {/* Funkcje Backend */}
          <Section title="Funkcje Backend (Deno)" icon={Settings}>
            <p className="text-sm text-gray-600 mb-3">Funkcje uruchamiane są na Deno Deploy, wywoływane przez <Code>base44.functions.invoke('nazwaFunkcji', payload)</Code>.</p>
            <Table
              headers={["Funkcja", "Opis", "Uprawnienia"]}
              rows={[
                ["getMeetingsFromSheets", "Pobiera spotkania i kontakty z Google Sheets — wszystkie aktywne zakładki", "admin/group_leader/team_leader"],
                ["refreshMeetingsCache", "Odświeża cache spotkań w bazie danych", "admin"],
                ["autoRefreshMeetings", "Automatyczne odświeżanie harmonogramu (scheduler)", "Scheduler"],
                ["handleMeetingAcceptance", "Przetwarza przyjęcie/odrzucenie spotkania, tworzy CalendarEvent", "Zalogowany user"],
                ["monitorMeetingRejections", "Sprawdza spotkania odrzucone 2+ razy i powiadamia liderów", "Scheduler"],
                ["getUsersInHierarchy", "Zwraca listę emaili użytkowników w hierarchii wywołującego", "Zalogowany user"],
                ["notifyMeetingAssigned", "Email/in-app przy przypisaniu spotkania doradcy", "Entity trigger"],
                ["notifyContactAssigned", "Email/in-app przy przypisaniu kontaktu telefonicznego", "Entity trigger"],
                ["notifyGroupLeaderNewMeetings", "Powiadamia lidera o nowych spotkaniach w grupie", "admin"],
                ["logActivity", "Zapisuje akcję w ActivityLog", "Zalogowany user"],
                ["trackUserActivity", "Aktualizuje last_activity w AllowedUser", "Zalogowany user"],
                ["checkMissingMeetingReports", "Sprawdza brakujące raporty i blokuje konta", "Scheduler"],
                ["checkMissingPhoneContacts", "Sprawdza brakujące raporty kontaktów", "Scheduler"],
                ["cleanupOldUnacceptedMeetings", "Usuwa stare niepodjęte spotkania", "Scheduler"],
                ["sendNotification", "Wysyła email przez Brevo API", "Internal"],
                ["sendReportEmail", "Wysyła raport wizytowy emailem do klienta", "Zalogowany user"],
                ["generateReportPDF", "Generuje PDF raportu wizytowego", "Zalogowany user"],
                ["generateChecklistPCPDF", "Generuje PDF checklisty", "Zalogowany user"],
                ["generateAutoconsumptionPDF", "Generuje PDF kalkulatora autokonsumpcji", "Zalogowany user"],
                ["generatePVCalculatorPDF", "Generuje PDF kalkulatora PV", "Zalogowany user"],
                ["generateROICalculatorPDF", "Generuje PDF kalkulatora ROI", "Zalogowany user"],
                ["exportReports", "Eksportuje raporty do Excel (base64) lub zwraca listę URL zdjęć", "admin"],
                ["exportReferralsToSheets", "Eksportuje polecenia do Google Sheets", "admin"],
                ["exportToGoogleSheets", "Ogólny eksport danych do Google Sheets", "admin"],
                ["syncAllowedUserWithBase44", "Synchronizuje AllowedUser z bazą auth Base44", "admin"],
                ["syncRegisteredUsers", "Rejestruje nowych użytkowników Base44 w AllowedUser", "admin"],
                ["syncGroupName", "Synchronizuje nazwę grupy w powiązanych rekordach", "Entity trigger"],
                ["syncAddressesToAssignments", "Uzupełnia adresy w MeetingAssignments", "admin"],
                ["requestAccess", "Obsługa publicznego formularza prośby o dostęp", "Publiczna"],
                ["autoCreateAccessRequest", "Automatycznie tworzy RegistrationRequest dla nowych userów", "System"],
                ["autoLogReportActivity", "Loguje aktywność przy tworzeniu raportów (entity trigger)", "Entity trigger"],
                ["checkInactiveReferrals", "Sprawdza polecenia bez aktywności i powiadamia", "Scheduler"],
                ["getEnergyPrices", "Pobiera aktualne ceny energii", "Zalogowany user"],
                ["getWeatherForecast", "Pobiera prognozę pogody (dla kalkulatorów)", "Zalogowany user"],
                ["getAppId", "Zwraca ID aplikacji", "Publiczna"],
                ["getAllSheetTabs", "Zwraca listę zakładek arkusza Google Sheets", "admin"],
                ["inspectSheet / debugClientRow", "Narzędzia diagnostyczne arkusza", "admin"],
                ["fixCalendarLocations", "Naprawia brakujące lokalizacje w CalendarEvents", "admin"],
              ]}
            />
          </Section>

          {/* Integracje */}
          <Section title="Zewnętrzne integracje" icon={Zap}>
            <Table
              headers={["Usługa", "Typ", "Użycie", "Sekret/Connector"]}
              rows={[
                ["Google Sheets", "OAuth connector (shared)", "Pobieranie leadów / eksport danych", "googlesheets connector"],
                ["Brevo (Sendinblue)", "API Key (backend)", "Wysyłka emaili — powiadomienia, raporty", "BREVO_API_KEY"],
                ["Base44 LLM (InvokeLLM)", "Wbudowana integracja", "Asystent AI (jeśli aktywowany)", "—"],
                ["Base44 UploadFile", "Wbudowana integracja", "Upload zdjęć do raportów", "—"],
                ["Base44 GenerateImage", "Wbudowana integracja", "Generowanie grafik (jeśli aktywowane)", "—"],
              ]}
            />
          </Section>

          {/* Automatyzacje */}
          <Section title="Automatyzacje (Schedulery)" icon={Calendar}>
            <p className="text-sm text-gray-600 mb-3">Zaplanowane zadania uruchamiane automatycznie przez platformę Base44:</p>
            <Table
              headers={["Funkcja", "Częstotliwość", "Cel"]}
              rows={[
                ["autoRefreshMeetings", "Co 1h", "Odświeżanie spotkań z Google Sheets"],
                ["checkMissingMeetingReports", "Codziennie", "Wykrywanie brakujących raportów i blokada kont"],
                ["checkMissingPhoneContacts", "Codziennie", "Wykrywanie brakujących raportów kontaktów"],
                ["cleanupOldUnacceptedMeetings", "Codziennie", "Usuwanie przeterminowanych niepodjętych spotkań"],
                ["checkInactiveReferrals", "Co tydzień", "Powiadamianie o nieaktywnych poleceniach"],
                ["monitorMeetingRejections", "Na zdarzenie (entity)", "Monitorowanie odrzuceń spotkań"],
              ]}
            />
          </Section>

          {/* Bezpieczeństwo */}
          <Section title="Bezpieczeństwo i autoryzacja" icon={Shield}>
            <div className="space-y-3 text-sm text-gray-700">
              <div className="p-3 bg-gray-50 rounded-lg">
                <strong>Uwierzytelnianie:</strong> Obsługiwane przez Base44 Auth. Każde żądanie do backendu jest podpisane tokenem użytkownika. Funkcje weryfikują tożsamość przez <Code>base44.auth.me()</Code>.
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <strong>Autoryzacja:</strong> Rola sprawdzana w tabeli <Code>AllowedUser</Code>. Funkcje admina zwracają <Code>403</Code> jeśli <Code>user.role !== 'admin'</Code>. Widoki frontendowe filtrują nawigację według roli.
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <strong>Blokada kont:</strong> Pole <Code>is_blocked</Code> i <Code>blocked_until</Code> w AllowedUser. Zablokowany użytkownik widzi ekran blokady zamiast treści aplikacji.
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <strong>Cache sesji:</strong> Dane użytkownika i uprawnień są cachowane w <Code>sessionStorage</Code> przez 5 minut, aby ograniczyć liczbę zapytań API przy każdym renderze.
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <strong>Sekrety:</strong> Klucze API (Brevo) przechowywane jako zmienne środowiskowe Deno, nigdy nie trafiają do frontendu.
              </div>
            </div>
          </Section>

          {/* Konwencje kodu */}
          <Section title="Konwencje i wzorce kodu" icon={Wrench}>
            <div className="space-y-3 text-sm text-gray-700">
              <div><strong>Data fetching:</strong> TanStack Query (<Code>useQuery</Code> / <Code>useMutation</Code>) dla wszystkich operacji CRUD. Cache invalidation przez <Code>queryClient.invalidateQueries()</Code>.</div>
              <div><strong>Formularze:</strong> Lokalny state React (<Code>useState</Code>). Brak react-hook-form w większości formularzy — prosta kontrola przez <Code>onChange</Code>.</div>
              <div><strong>Routing:</strong> HashRouter. Strony dodawane jako osobne <Code>&lt;Route&gt;</Code> w <Code>App.jsx</Code>. Nawigacja przez <Code>{'<Link to={createPageUrl("PageName")}>'}</Code>.</div>
              <div><strong>Komponenty:</strong> Małe, focused. Każdy komponent w osobnym pliku. Foldery tematyczne: <Code>components/calendar/</Code>, <Code>components/reports/</Code>, <Code>components/user-management/</Code>.</div>
              <div><strong>Animacje:</strong> Framer Motion (<Code>motion.div</Code>) dla wejść stron i kart.</div>
              <div><strong>Toast:</strong> <Code>react-hot-toast</Code> do prostych powiadomień, <Code>sonner</Code> w niektórych komponentach.</div>
              <div><strong>Ikony:</strong> Wyłącznie Lucide React.</div>
              <div><strong>Design tokens:</strong> Kolory przez CSS variables w <Code>index.css</Code>, mapowane w <Code>tailwind.config.js</Code>. Główny kolor: <Code>green-600</Code>.</div>
            </div>
          </Section>

          {/* Offline */}
          <Section title="Obsługa offline" icon={Zap}>
            <p className="text-sm text-gray-700">
              Komponent <Code>OfflineBanner</Code> wykrywa brak połączenia i wyświetla baner na górze strony.
              Moduł <Code>components/offline/offlineSync</Code> buforuje operacje offline i synchronizuje je po przywróceniu połączenia.
              Aplikacja jest responsywna i zaprojektowana jako PWA-friendly (mobile-first).
            </p>
          </Section>

          {/* Dodawanie nowych stron */}
          <Section title="Jak dodać nową stronę / moduł" icon={Settings}>
            <ol className="space-y-2 text-sm text-gray-700">
              <li className="flex gap-2"><span className="font-bold text-green-600">1.</span> Utwórz plik <Code>pages/NazwaStrony.jsx</Code> z domyślnym eksportem komponentu.</li>
              <li className="flex gap-2"><span className="font-bold text-green-600">2.</span> Dodaj import na górze <Code>App.jsx</Code>: <Code>import NazwaStrony from '@/pages/NazwaStrony'</Code></li>
              <li className="flex gap-2"><span className="font-bold text-green-600">3.</span> Dodaj <Code>&lt;Route path="/NazwaStrony" element={`<LayoutWrapper currentPageName="NazwaStrony"><NazwaStrony /></LayoutWrapper>`} /&gt;</Code> do <Code>&lt;Routes&gt;</Code> w <Code>App.jsx</Code>.</li>
              <li className="flex gap-2"><span className="font-bold text-green-600">4.</span> (Opcjonalnie) Dodaj wpis w <Code>navStructure</Code> w pliku <Code>Layout.jsx</Code> aby strona pojawiła się w nawigacji.</li>
              <li className="flex gap-2"><span className="font-bold text-green-600">5.</span> Jeśli strona wymaga nowej encji — utwórz <Code>entities/NazwaEncji.json</Code> z JSON Schema.</li>
            </ol>
          </Section>
        </div>
      )}
      </div>{/* end doc-content */}
    </div>
  );
}