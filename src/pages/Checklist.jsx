import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/shared/PageHeader";
import ReportSelector from "../components/reports/ReportSelector";
import { smartUpdate } from "@/components/offline/offlineSync";
import useCurrentUser from "@/components/shared/useCurrentUser";
import SignaturePad from "@/components/shared/SignaturePad";
import PhotoUploader from "@/components/shared/PhotoUploader";

const Check = () => (
  <svg className="w-4 h-4 text-white" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
  </svg>
);

// ── PV ──────────────────────────────────────────────────────────────────────

const pvInitialState = {
  client_name: "", client_address: "", client_phone: "",
  visit_date: new Date().toISOString().split("T")[0],
  installation_types: [], launch_date: "", contractor: "",
  annual_production_kwh: "", energy_imported_kwh: "", energy_exported_kwh: "",
  autoconsumption_rating: "", panels_condition: "", mounting_condition: "",
  cables_condition: "", protection_condition: "", inverter_reading: "",
  grounding_condition: "", expansion_possibilities: "", modernization_potential: "",
  recommendations: "", additional_notes: "", client_signature: "",
};

const pvChecklistItems = [
  { key: "autoconsumption_rating", label: "Ocena autokonsumpcji i bilansu z siecią", placeholder: "Wylicza się automatycznie", readOnly: true },
  { key: "panels_condition", label: "Wizualna kontrola paneli/modułów (pęknięcia, zabrudzenia)", placeholder: "np. Panele czyste, brak pęknięć" },
  { key: "mounting_condition", label: "Kontrola mocowań i konstrukcji nośnej", placeholder: "np. Mocowania stabilne, brak korozji" },
  { key: "cables_condition", label: "Wizualne sprawdzenie przewodów DC/AC, połączeń MC4", placeholder: "np. Wszystkie MC4 szczelne" },
  { key: "protection_condition", label: "Wizualny stan zabezpieczeń: SPD, RCD, wyłączniki", placeholder: "np. SPD sprawne, RCD testowane – OK" },
  { key: "inverter_reading", label: "Odczyt falownika: błędy, produkcja, komunikacja", placeholder: "np. Brak błędów, komunikacja Wi-Fi OK" },
  { key: "grounding_condition", label: "Wizualna kontrola uziemienia i ciągłości przewodów ochronnych", placeholder: "np. Uziemienie wizualnie OK" },
  { key: "expansion_possibilities", label: "Ocena możliwości rozbudowy: miejsce, przyłącze, ograniczenia", placeholder: "np. Dach pozwala na +6 paneli" },
  { key: "modernization_potential", label: "Wstępna kalkulacja potencjału modernizacji (kWh/rok)", placeholder: "np. +3200 kWh/rok po dodaniu magazynu" },
  { key: "recommendations", label: "Rekomendacje: serwis, czyszczenie, wymiana elementów krytycznych", placeholder: "Zalecane: czyszczenie paneli, przegląd SPD" },
  { key: "additional_notes", label: "Dodatkowa rekomendacja", placeholder: "np. Montaż optymalizatorów" },
];

const installationOptions = ["PV", "Pompa ciepła", "Magazyn energii"];

// ── PC ──────────────────────────────────────────────────────────────────────

const pcAuditFields = [
  { key: "pc_data_przegladu", label: "Data realizowanego przeglądu", section: "Dane klienta / instalacji", type: "date" },
  { key: "pc_data_ostatniego", label: "Data ostatniego przeglądu", section: "Dane klienta / instalacji", type: "date" },
  { key: "pc_nazwa_adres", label: "Nazwa i adres firmy wykonującej", section: "Dane osoby wykonującej przegląd", placeholder: "np. 4-Eco Green Energy" },
  { key: "pc_imie_nazwisko", label: "Imię i nazwisko wykonawcy", section: "Dane osoby wykonującej przegląd", placeholder: "np. Jan Kowalski" },
  { key: "pc_opis_czynnosci", label: "Opis czynności do wykonania / opis przeglądu", section: "Lista wykonanych czynności", placeholder: "Wykonano przegląd pompy ciepła...", multiline: true },
  { key: "pc_uwagi_serwisowe", label: "Uwagi serwisowe / stwierdzone usterki", section: "Lista wykonanych czynności", placeholder: "np. Brak dostępu do filtra magnetycznego", multiline: true },
  { key: "pc_stan_pompy", label: "Stan ogólny pompy ciepła / kotła", section: "Stan techniczny urządzenia", placeholder: "np. Urządzenie w dobrym stanie technicznym" },
  { key: "pc_filtr_magnetyczny", label: "Stan filtra magnetycznego", section: "Stan techniczny urządzenia", placeholder: "np. Filtr czysty, sprawny" },
  { key: "pc_oslona_przewodow", label: "Osłona przewodów przed promieniowaniem UV", section: "Stan techniczny urządzenia", placeholder: "np. Brak osłony – zalecany montaż" },
  { key: "pc_cisnienie_czynnika", label: "Ciśnienie czynnika chłodniczego", section: "Stan techniczny urządzenia", placeholder: "np. 18 bar – prawidłowe" },
  { key: "pc_temperatura_pracy", label: "Temperatura pracy / odczyt sterownika", section: "Stan techniczny urządzenia", placeholder: "np. CWU: 55°C, CO: 45°C" },
  { key: "pc_gwarancja", label: "Status gwarancji", section: "Stan techniczny urządzenia", placeholder: "np. Urządzenie na gwarancji" },
  { key: "pc_opis_wykonanych", label: "Opis wykonanych czynności (podsumowanie)", section: "Odbiór prac", placeholder: "np. Odebrane bez zastrzeżeń", multiline: true },
  { key: "pc_godz_przyjazdu", label: "Godzina przyjazdu", section: "Czas wykonania", type: "time" },
  { key: "pc_godz_wyjazdu", label: "Godzina wyjazdu", section: "Czas wykonania", type: "time" },
  { key: "pc_rekomendacje", label: "Rekomendacje i zalecenia serwisowe", section: "Rekomendacje", placeholder: "np. Zalecany montaż osłon UV", multiline: true },
  { key: "pc_dodatkowe_uwagi", label: "Dodatkowe uwagi", section: "Rekomendacje", placeholder: "np. Kolejny przegląd za 12 miesięcy", multiline: true },
];

const pcInitialState = Object.fromEntries(
  pcAuditFields.map(f => [
    f.key,
    f.key === "pc_data_przegladu" ? new Date().toISOString().split("T")[0]
    : f.key === "pc_nazwa_adres" ? "4-Eco Green Energy"
    : ""
  ])
);

// ── Main ─────────────────────────────────────────────────────────────────────

export default function Checklist() {
  const urlParams = new URLSearchParams(window.location.search);
  const prefillData = urlParams.get("from_meeting") === "1" ? {
    client_name: urlParams.get("prefill_client_name") || "",
    client_phone: urlParams.get("prefill_client_phone") || "",
    client_address: urlParams.get("prefill_client_address") || "",
    visit_date: urlParams.get("prefill_meeting_date") || new Date().toISOString().split("T")[0],
  } : null;

  const { currentUser } = useCurrentUser();
  const isAdmin = currentUser?.role === "admin";

  const [checklistMode, setChecklistMode] = useState("PV");

  // ── PV state ────────────────────────────────────────────────────────────
  const [currentReport, setCurrentReport] = useState(null);
  const [form, setForm] = useState(prefillData ? { ...pvInitialState, ...prefillData } : pvInitialState);
  const [completedItems, setCompletedItems] = useState({});
  const [pvSignature, setPvSignature] = useState("");
  const [pvPhotos, setPvPhotos] = useState([]);
  const pvSaveRef = useRef(null);

  // ── PC state ────────────────────────────────────────────────────────────
  const [pcForm, setPcForm] = useState(pcInitialState);
  const [pcCompleted, setPcCompleted] = useState({});
  const [pcClientName, setPcClientName] = useState("");
  const [pcClientPhone, setPcClientPhone] = useState("");
  const [pcClientAddress, setPcClientAddress] = useState("");
  const [pcWorkerSig, setPcWorkerSig] = useState("");
  const [pcClientSig, setPcClientSig] = useState("");
  const [pcPhotos, setPcPhotos] = useState([]);
  const [pcReportId, setPcReportId] = useState(null);
  const pcSaveRef = useRef(null);

  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pcSaveStatus, setPcSaveStatus] = useState(""); // "", "saving", "saved"

  useEffect(() => {
    base44.functions.invoke('logActivity', { action_type: 'page_view', page_name: 'Checklist' }).catch(() => {});
  }, []);

  // Load PV report into form
  useEffect(() => {
    if (!currentReport) return;
    setForm({
      client_name: currentReport.client_name || "",
      client_address: currentReport.client_address || "",
      client_phone: currentReport.client_phone || "",
      visit_date: currentReport.visit_date || new Date().toISOString().split("T")[0],
      installation_types: currentReport.installation_types || [],
      launch_date: currentReport.launch_date || "",
      contractor: currentReport.contractor || "",
      annual_production_kwh: currentReport.annual_production_kwh || "",
      energy_imported_kwh: currentReport.energy_imported_kwh || "",
      energy_exported_kwh: currentReport.energy_exported_kwh || "",
      autoconsumption_rating: currentReport.autoconsumption_rating || "",
      panels_condition: currentReport.panels_condition || "",
      mounting_condition: currentReport.mounting_condition || "",
      cables_condition: currentReport.cables_condition || "",
      protection_condition: currentReport.protection_condition || "",
      inverter_reading: currentReport.inverter_reading || "",
      grounding_condition: currentReport.grounding_condition || "",
      expansion_possibilities: currentReport.expansion_possibilities || "",
      modernization_potential: currentReport.modernization_potential || "",
      recommendations: currentReport.recommendations || "",
      additional_notes: currentReport.additional_notes || "",
      client_signature: currentReport.client_signature || "",
    });
    if (currentReport.client_signature_image) setPvSignature(currentReport.client_signature_image);
    if (currentReport.photos) setPvPhotos(currentReport.photos);
  }, [currentReport]);

  // ── PV auto-save ─────────────────────────────────────────────────────────
  const pvAutoSave = (updatedForm, sig, photos) => {
    if (!currentReport) return;
    if (pvSaveRef.current) clearTimeout(pvSaveRef.current);
    pvSaveRef.current = setTimeout(async () => {
      const data = { ...updatedForm };
      if (data.annual_production_kwh) data.annual_production_kwh = parseFloat(data.annual_production_kwh);
      if (data.energy_imported_kwh) data.energy_imported_kwh = parseFloat(data.energy_imported_kwh);
      if (data.energy_exported_kwh) data.energy_exported_kwh = parseFloat(data.energy_exported_kwh);
      data.client_signature_image = sig;
      data.photos = photos;
      await smartUpdate(base44.entities.VisitReport, "VisitReport", currentReport.id, data);
    }, 1000);
  };

  const update = (key, value) => {
    const newForm = { ...form, [key]: value };
    if (["annual_production_kwh", "energy_exported_kwh", "energy_imported_kwh"].includes(key)) {
      const production = parseFloat(key === "annual_production_kwh" ? value : newForm.annual_production_kwh) || 0;
      const exported = parseFloat(key === "energy_exported_kwh" ? value : newForm.energy_exported_kwh) || 0;
      const imported = parseFloat(key === "energy_imported_kwh" ? value : newForm.energy_imported_kwh) || 0;
      if (production > 0) {
        const selfUsed = production - exported;
        const total = selfUsed + imported;
        const ac = (selfUsed / production) * 100;
        const ss = total > 0 ? (selfUsed / total) * 100 : 0;
        newForm.autoconsumption_rating = `Autokonsumpcja: ${ac.toFixed(1)}%, Samowystarczalność: ${ss.toFixed(1)}%, Pobór z sieci: ${imported} kWh`;
      }
    }
    setForm(newForm);
    pvAutoSave(newForm, pvSignature, pvPhotos);
  };

  const handlePvSig = (s) => { setPvSignature(s); pvAutoSave(form, s, pvPhotos); };
  const handlePvPhotos = (p) => { setPvPhotos(p); pvAutoSave(form, pvSignature, p); };
  const toggleInstallation = (type) => {
    const types = form.installation_types.includes(type)
      ? form.installation_types.filter(t => t !== type)
      : [...form.installation_types, type];
    update("installation_types", types);
  };
  const toggleCompleted = (key) => setCompletedItems(p => ({ ...p, [key]: !p[key] }));

  // ── PC auto-save to ServiceReport ────────────────────────────────────────
  const pcAutoSave = (fields, photos, workerSig, clientSig, name, phone, address) => {
    if (pcSaveRef.current) clearTimeout(pcSaveRef.current);
    setPcSaveStatus("saving");
    pcSaveRef.current = setTimeout(async () => {
      const data = {
        client_name: name || pcClientName,
        client_phone: phone || pcClientPhone,
        client_address: address || pcClientAddress,
        service_date: fields.pc_data_przegladu || new Date().toISOString().split("T")[0],
        report_type: "PC",
        fields,
        photos,
        worker_signature: workerSig,
        client_signature: clientSig,
        status: "draft",
        author_name: currentUser?.displayName || currentUser?.full_name || "",
        author_email: currentUser?.email || "",
      };
      if (pcReportId) {
        await base44.entities.ServiceReport.update(pcReportId, data);
      } else {
        const created = await base44.entities.ServiceReport.create(data);
        setPcReportId(created.id);
      }
      setPcSaveStatus("saved");
    }, 1200);
  };

  const updatePc = (key, value) => {
    const newFields = { ...pcForm, [key]: value };
    setPcForm(newFields);
    pcAutoSave(newFields, pcPhotos, pcWorkerSig, pcClientSig, pcClientName, pcClientPhone, pcClientAddress);
  };
  const togglePcCompleted = (key) => setPcCompleted(p => ({ ...p, [key]: !p[key] }));

  const handlePcClientName = (v) => { setPcClientName(v); pcAutoSave(pcForm, pcPhotos, pcWorkerSig, pcClientSig, v, pcClientPhone, pcClientAddress); };
  const handlePcClientPhone = (v) => { setPcClientPhone(v); pcAutoSave(pcForm, pcPhotos, pcWorkerSig, pcClientSig, pcClientName, v, pcClientAddress); };
  const handlePcClientAddress = (v) => { setPcClientAddress(v); pcAutoSave(pcForm, pcPhotos, pcWorkerSig, pcClientSig, pcClientName, pcClientPhone, v); };
  const handlePcPhotos = (p) => { setPcPhotos(p); pcAutoSave(pcForm, p, pcWorkerSig, pcClientSig, pcClientName, pcClientPhone, pcClientAddress); };
  const handlePcWorkerSig = (s) => { setPcWorkerSig(s); pcAutoSave(pcForm, pcPhotos, s, pcClientSig, pcClientName, pcClientPhone, pcClientAddress); };
  const handlePcClientSig = (s) => { setPcClientSig(s); pcAutoSave(pcForm, pcPhotos, pcWorkerSig, s, pcClientName, pcClientPhone, pcClientAddress); };

  // ── Eksport PV ───────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (!currentReport) return;
    setSaving(true);
    try { await base44.functions.invoke('exportToGoogleSheets', { reportId: currentReport.id }); }
    catch (e) { console.error(e); }
    setSaving(false);
  };

  const handleGeneratePvPdf = async () => {
    if (!currentReport) return;
    setGeneratingPdf(true);
    try {
      const res = await base44.functions.invoke('generateReportPDF', { reportId: currentReport.id });
      if (res.data?.pdf_base64) {
        const link = document.createElement("a");
        link.href = `data:application/pdf;base64,${res.data.pdf_base64}`;
        link.download = res.data.filename || "raport.pdf";
        link.click();
      }
    } catch (e) { console.error(e); }
    setGeneratingPdf(false);
  };

  const handleGeneratePcPdf = async () => {
    setGeneratingPdf(true);
    try {
      const payload = {
        client_name: pcClientName, client_phone: pcClientPhone, client_address: pcClientAddress,
        worker_signature: pcWorkerSig, client_signature: pcClientSig,
        photos: pcPhotos, fields: pcForm,
      };
      const res = await base44.functions.invoke('generateChecklistPCPDF', payload);
      if (res.data?.pdf_base64) {
        const link = document.createElement("a");
        link.href = `data:application/pdf;base64,${res.data.pdf_base64}`;
        link.download = res.data.filename || "protokol_pc.pdf";
        link.click();
      }
    } catch (e) { console.error(e); }
    setGeneratingPdf(false);
  };

  const completedCount = Object.values(completedItems).filter(Boolean).length;
  const totalItems = pvChecklistItems.length;
  const progress = totalItems > 0 ? (completedCount / totalItems) * 100 : 0;

  const pcSections = [...new Set(pcAuditFields.map(f => f.section))];
  const pcCompletedCount = Object.values(pcCompleted).filter(Boolean).length;
  const pcProgress = (pcCompletedCount / pcAuditFields.length) * 100;

  // ── Mode Toggle ──────────────────────────────────────────────────────────
  const ModeToggle = () => (
    <div className="flex items-center bg-gray-100 rounded-xl p-1 w-fit">
      {["PV", "PC"].map(mode => (
        <button key={mode} onClick={() => setChecklistMode(mode)}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
            checklistMode === mode ? "bg-white text-green-700 shadow-sm border border-green-200" : "text-gray-500 hover:text-gray-700"
          }`}>
          {mode === "PV" ? "Fotowoltaika (PV)" : "Pompa ciepła (PC)"}
        </button>
      ))}
    </div>
  );

  // ── No report selected (PV mode) ─────────────────────────────────────────
  if (!currentReport && checklistMode === "PV") {
    return (
      <div className="space-y-6">
        <PageHeader title="Checklista Doradcy Technicznego" subtitle="Analiza i modernizacja instalacji" />
        {isAdmin && <ModeToggle />}
        <ReportSelector onSelectReport={setCurrentReport} currentReport={null} />
      </div>
    );
  }

  // ── PC MODE ──────────────────────────────────────────────────────────────
  if (checklistMode === "PC" && isAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader title="Protokół Przeglądu / Audytu PC" subtitle="Pompa ciepła / Kocioł" />
        <div className="flex items-center justify-between flex-wrap gap-2">
          <ModeToggle />
          <div className="text-xs text-gray-500">
            {pcSaveStatus === "saving" && <span className="text-orange-500">Zapisywanie...</span>}
            {pcSaveStatus === "saved" && <span className="text-green-600">✓ Zapisano w systemie</span>}
            {pcReportId && <span className="ml-2 text-gray-400">ID: {pcReportId.slice(-6)}</span>}
          </div>
        </div>

        {/* Progress */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">Postęp protokołu</span>
            <span className="text-sm font-semibold text-orange-600">{pcCompletedCount}/{pcAuditFields.length}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <motion.div className="h-full bg-orange-500 rounded-full" initial={{ width: 0 }} animate={{ width: `${pcProgress}%` }} transition={{ duration: 0.5 }} />
          </div>
        </div>

        {/* Dane klienta */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="text-base font-semibold text-gray-900">Dane klienta</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-700 text-xs mb-1">Imię i nazwisko klienta</Label>
              <Input value={pcClientName} onChange={e => handlePcClientName(e.target.value)} placeholder="Jan Kowalski" />
            </div>
            <div>
              <Label className="text-gray-700 text-xs mb-1">Telefon</Label>
              <Input value={pcClientPhone} onChange={e => handlePcClientPhone(e.target.value)} placeholder="600 123 456" />
            </div>
            <div className="md:col-span-2">
              <Label className="text-gray-700 text-xs mb-1">Adres obiektu</Label>
              <Input value={pcClientAddress} onChange={e => handlePcClientAddress(e.target.value)} placeholder="ul. Słoneczna 12, 00-000 Warszawa" />
            </div>
          </div>
        </div>

        {/* Sekcje protokołu */}
        {pcSections.map(section => {
          const fields = pcAuditFields.filter(f => f.section === section);
          return (
            <div key={section} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <h3 className="text-sm font-bold text-orange-700 uppercase tracking-wide">{section}</h3>
              {fields.map(field => (
                <motion.div key={field.key}
                  className={`rounded-lg border p-4 transition-all ${pcCompleted[field.key] ? "bg-orange-50 border-orange-200" : "bg-white border-gray-200"}`}>
                  <div className="flex items-start gap-3">
                    <button onClick={() => togglePcCompleted(field.key)}
                      className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-all ${
                        pcCompleted[field.key] ? "bg-orange-500 border-orange-500" : "border-gray-300 hover:border-gray-400"
                      }`}>
                      {pcCompleted[field.key] && <Check />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <Label className="text-gray-700 text-sm font-medium">{field.label}</Label>
                      {field.multiline ? (
                        <textarea value={pcForm[field.key]} onChange={e => updatePc(field.key, e.target.value)}
                          placeholder={field.placeholder || ""} rows={3}
                          className="mt-2 w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none" />
                      ) : (
                        <Input type={field.type || "text"} value={pcForm[field.key]}
                          onChange={e => updatePc(field.key, e.target.value)}
                          placeholder={field.placeholder || ""} className="mt-2 text-sm" />
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          );
        })}

        {/* Zdjęcia */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <PhotoUploader photos={pcPhotos} onChange={handlePcPhotos} label="Zdjęcia z przeglądu" />
        </div>

        {/* Podpisy */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-6">
          <h3 className="text-base font-semibold text-gray-900">Podpisy</h3>
          <SignaturePad value={pcWorkerSig} onChange={handlePcWorkerSig} label="Podpis pracownika" />
          <SignaturePad value={pcClientSig} onChange={handlePcClientSig} label="Podpis klienta" />
        </div>

        {/* Akcje */}
        <div className="flex gap-3">
          <Button onClick={handleGeneratePcPdf} disabled={generatingPdf}
            className="flex-1 h-12 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg">
            {generatingPdf
              ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : "Generuj PDF protokołu"}
          </Button>
        </div>
        <div className="text-center text-sm text-gray-500">Raport zapisuje się automatycznie w systemie</div>
      </div>
    );
  }

  // ── PV MODE ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageHeader title="Checklista Doradcy Technicznego" subtitle="Analiza i modernizacja instalacji" />
      {isAdmin && <ModeToggle />}
      <ReportSelector onSelectReport={setCurrentReport} currentReport={currentReport} />

      {/* Progress */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-600">Postęp kontroli</span>
          <span className="text-sm font-semibold text-green-600">{completedCount}/{totalItems}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <motion.div className="h-full bg-green-500 rounded-full" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.5 }} />
        </div>
      </div>

      {/* Dane klienta */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="text-base font-semibold text-gray-900">Dane klienta</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label className="text-gray-700 text-xs mb-1">Imię i nazwisko *</Label>
            <Input value={form.client_name} onChange={e => update("client_name", e.target.value)} placeholder="Jan Kowalski" /></div>
          <div><Label className="text-gray-700 text-xs mb-1">Telefon</Label>
            <Input value={form.client_phone} onChange={e => update("client_phone", e.target.value)} placeholder="600 123 456" /></div>
          <div className="md:col-span-2"><Label className="text-gray-700 text-xs mb-1">Adres</Label>
            <Input value={form.client_address} onChange={e => update("client_address", e.target.value)} placeholder="ul. Słoneczna 12, 00-000 Warszawa" /></div>
          <div><Label className="text-gray-700 text-xs mb-1">Data wizyty</Label>
            <Input type="date" value={form.visit_date} onChange={e => update("visit_date", e.target.value)} /></div>
        </div>
        <div>
          <Label className="text-gray-700 text-xs mb-2 block">Rodzaj instalacji</Label>
          <div className="flex flex-wrap gap-2">
            {installationOptions.map(opt => (
              <button key={opt} onClick={() => toggleInstallation(opt)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                  form.installation_types.includes(opt)
                    ? "bg-green-50 text-green-600 border-green-500"
                    : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                }`}>{opt}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Dane instalacji */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="text-base font-semibold text-gray-900">Dane instalacji</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label className="text-gray-700 text-xs mb-1">Data uruchomienia</Label>
            <Input value={form.launch_date} onChange={e => update("launch_date", e.target.value)} placeholder="2023-06-15" /></div>
          <div><Label className="text-gray-700 text-xs mb-1">Wykonawca</Label>
            <Input value={form.contractor} onChange={e => update("contractor", e.target.value)} placeholder="Nazwa firmy" /></div>
          <div><Label className="text-gray-700 text-xs mb-1">TOTAL z falownika [kWh]</Label>
            <Input type="number" value={form.annual_production_kwh} onChange={e => update("annual_production_kwh", e.target.value)} placeholder="8500" /></div>
          <div><Label className="text-gray-700 text-xs mb-1">Energia pobrana 1.8.0 [kWh]</Label>
            <Input type="number" value={form.energy_imported_kwh} onChange={e => update("energy_imported_kwh", e.target.value)} placeholder="3200" /></div>
          <div><Label className="text-gray-700 text-xs mb-1">Energia oddana 2.8.0 [kWh]</Label>
            <Input type="number" value={form.energy_exported_kwh} onChange={e => update("energy_exported_kwh", e.target.value)} placeholder="5300" /></div>
        </div>
      </div>

      {/* Kontrola techniczna */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h3 className="text-base font-semibold text-gray-900">Kontrola techniczna</h3>
        {pvChecklistItems.map(ci => (
          <motion.div key={ci.key}
            className={`rounded-lg border p-4 transition-all ${completedItems[ci.key] ? "bg-green-50 border-green-200" : "bg-white border-gray-200"}`}>
            <div className="flex items-start gap-3">
              <button onClick={() => toggleCompleted(ci.key)}
                className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-all ${
                  completedItems[ci.key] ? "bg-green-500 border-green-500" : "border-gray-300 hover:border-gray-400"
                }`}>
                {completedItems[ci.key] && <Check />}
              </button>
              <div className="flex-1 min-w-0">
                <Label className="text-gray-700 text-sm font-medium">{ci.label}</Label>
                <Input value={form[ci.key]} onChange={e => update(ci.key, e.target.value)}
                  placeholder={ci.placeholder} className="mt-2 text-sm" readOnly={ci.readOnly} disabled={ci.readOnly} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Zdjęcia */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <PhotoUploader photos={pvPhotos} onChange={handlePvPhotos} label="Zdjęcia z wizyty" />
      </div>

      {/* Podpis */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <SignaturePad value={pvSignature} onChange={handlePvSig} label="Podpis klienta" />
      </div>

      {/* Akcje */}
      <div className="flex gap-3">
        <Button onClick={handleExport} disabled={saving}
          className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg">
          {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Zapisz do Sheets"}
        </Button>
        <Button onClick={handleGeneratePvPdf} disabled={generatingPdf}
          className="flex-1 h-12 bg-gray-800 hover:bg-gray-900 text-white font-semibold rounded-lg">
          {generatingPdf ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Generuj PDF"}
        </Button>
      </div>
      <div className="text-center text-sm text-gray-500">Zmiany zapisują się automatycznie</div>
    </div>
  );
}