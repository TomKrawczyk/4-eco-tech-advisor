import React, { useState } from "react";
import { ArrowLeft, Trash2, Clock, CheckCircle2, Send, User, MapPin, Phone, Calendar, Zap, Wrench, Download, Mail, Table } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import ProductionChart from "../charts/ProductionChart";
import AutoconsumptionPieChart from "../charts/AutoconsumptionPieChart";

const statusConfig = {
  draft: { label: "Szkic", icon: Clock, color: "bg-gray-100 text-gray-700 border-gray-300" },
  completed: { label: "Ukończony", icon: CheckCircle2, color: "bg-green-100 text-green-700 border-green-300" },
  sent: { label: "Wysłany", icon: Send, color: "bg-blue-100 text-blue-700 border-blue-300" },
};

const statuses = ["draft", "completed", "sent"];

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-sm text-gray-900">{typeof value === "object" ? value.join(", ") : value}</div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  const hasContent = React.Children.toArray(children).some(Boolean);
  if (!hasContent) return null;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-1">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function CheckItem({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
      <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-sm text-gray-900">{value}</div>
      </div>
    </div>
  );
}

export default function ReportDetail({ report, onBack, onDelete, onStatusChange }) {
  const st = statusConfig[report.status || "draft"];
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailType, setEmailType] = useState('client');
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const response = await base44.functions.invoke('generateReportPDF', { reportId: report.id });
      
      // Create blob from ArrayBuffer response
      const blob = new Blob([response.data], { type: 'application/pdf' });
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `raport_${report.client_name?.replace(/\s+/g, '_') || 'wizyta'}.pdf`;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      setTimeout(() => {
        URL.revokeObjectURL(url);
        document.body.removeChild(link);
      }, 100);
      
      // Log activity
      base44.functions.invoke('logActivity', {
        action_type: 'report_export',
        page_name: 'VisitReports',
        report_id: report.id,
        details: { client_name: report.client_name, export_type: 'PDF' }
      }).catch(err => console.error('Log error:', err));
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Błąd podczas pobierania PDF: ' + error.message);
    } finally {
      setDownloading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!emailRecipient.trim()) {
      alert('Podaj adres email');
      return;
    }
    setSending(true);
    try {
      await base44.functions.invoke('sendReportEmail', {
        reportId: report.id,
        recipientEmail: emailRecipient,
        recipientType: emailType
      });
      alert('Raport został wysłany!');
      setShowEmailForm(false);
      setEmailRecipient('');
      
      // Log activity
      base44.functions.invoke('logActivity', {
        action_type: 'report_send_email',
        page_name: 'VisitReports',
        report_id: report.id,
        details: { client_name: report.client_name, recipient: emailRecipient }
      }).catch(err => console.error('Log error:', err));
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Błąd podczas wysyłania emaila');
    } finally {
      setSending(false);
    }
  };

  const handleExportToSheets = async () => {
    setExporting(true);
    try {
      await base44.functions.invoke('exportToGoogleSheets', { reportId: report.id });
      alert('Raport wyeksportowany do Google Sheets!');
      
      // Log activity
      base44.functions.invoke('logActivity', {
        action_type: 'report_export',
        page_name: 'VisitReports',
        report_id: report.id,
        details: { client_name: report.client_name, export_type: 'Google Sheets' }
      }).catch(err => console.error('Log error:', err));
    } catch (error) {
      console.error('Error exporting to Google Sheets:', error);
      alert('Błąd podczas eksportu do Google Sheets');
    } finally {
      setExporting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Wróć</span>
        </button>
        <div className="flex gap-2">
          <Button
            onClick={handleDownloadPDF}
            disabled={downloading}
            variant="outline"
            size="sm"
            className="text-green-600 border-green-600 hover:bg-green-50"
          >
            {downloading ? (
              <div className="w-4 h-4 border-2 border-green-600/30 border-t-green-600 rounded-full animate-spin" />
            ) : (
              <><Download className="w-4 h-4 mr-1" /> PDF</>
            )}
          </Button>
          <Button
            onClick={() => setShowEmailForm(!showEmailForm)}
            variant="outline"
            size="sm"
            className="text-blue-600 border-blue-600 hover:bg-blue-50"
          >
            <Mail className="w-4 h-4 mr-1" /> Wyślij
          </Button>
          <Button
            onClick={handleExportToSheets}
            disabled={exporting}
            variant="outline"
            size="sm"
            className="text-emerald-600 border-emerald-600 hover:bg-emerald-50"
          >
            {exporting ? (
              <div className="w-4 h-4 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" />
            ) : (
              <><Table className="w-4 h-4 mr-1" /> Sheets</>
            )}
          </Button>
          <Button
            onClick={onDelete}
            variant="ghost"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-1" /> Usuń
          </Button>
        </div>
      </div>

      {/* Email form */}
      {showEmailForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-white rounded-xl border border-gray-200 p-5 space-y-4"
        >
          <h3 className="text-base font-semibold text-gray-900">Wyślij raport mailem</h3>
          <div className="space-y-3">
            <div>
              <Label className="text-gray-700 text-xs mb-1">Adres email</Label>
              <Input
                type="email"
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
                placeholder="email@example.com"
              />
            </div>
            <div>
              <Label className="text-gray-700 text-xs mb-2 block">Odbiorca</Label>
              <div className="flex gap-2">
                <button
                  onClick={() => setEmailType('client')}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                    emailType === 'client'
                      ? 'bg-green-50 text-green-600 border-green-500'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  Klient
                </button>
                <button
                  onClick={() => setEmailType('manager')}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                    emailType === 'manager'
                      ? 'bg-green-50 text-green-600 border-green-500'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  Manager
                </button>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleSendEmail}
              disabled={sending || !emailRecipient.trim()}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {sending ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <><Mail className="w-4 h-4 mr-2" /> Wyślij</>
              )}
            </Button>
            <Button
              onClick={() => setShowEmailForm(false)}
              variant="outline"
            >
              Anuluj
            </Button>
          </div>
        </motion.div>
      )}

      {/* Title card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">{report.client_name || "Raport"}</h2>
          <Badge variant="outline" className={`border ${st.color}`}>{st.label}</Badge>
        </div>

        {/* Status buttons */}
        <div className="flex gap-2 flex-wrap">
          {statuses.map((s) => {
            const cfg = statusConfig[s];
            const isActive = (report.status || "draft") === s;
            return (
              <button
                key={s}
                onClick={() => onStatusChange(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  isActive ? cfg.color : "border-gray-300 text-gray-600 hover:border-gray-400"
                }`}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Client info */}
      <Section title="Dane klienta">
        <InfoRow icon={User} label="Klient" value={report.client_name} />
        <InfoRow icon={MapPin} label="Adres" value={report.client_address} />
        <InfoRow icon={Phone} label="Telefon" value={report.client_phone} />
        <InfoRow icon={Calendar} label="Data wizyty" value={report.visit_date ? new Date(report.visit_date).toLocaleDateString("pl-PL") : null} />
        <InfoRow icon={Zap} label="Rodzaj instalacji" value={report.installation_types} />
      </Section>

      {/* Installation data */}
      <Section title="Dane instalacji">
        <InfoRow icon={Calendar} label="Data uruchomienia" value={report.launch_date} />
        <InfoRow icon={Wrench} label="Wykonawca" value={report.contractor} />
        <InfoRow icon={Zap} label="Roczna produkcja" value={report.annual_production_kwh ? `${report.annual_production_kwh} kWh` : null} />
        <InfoRow icon={Zap} label="Energia pobrana (1.8.0)" value={report.energy_imported_kwh ? `${report.energy_imported_kwh} kWh` : null} />
        <InfoRow icon={Zap} label="Energia oddana (2.8.0)" value={report.energy_exported_kwh ? `${report.energy_exported_kwh} kWh` : null} />
      </Section>

      {/* Charts */}
      {report.annual_production_kwh && report.energy_exported_kwh && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ProductionChart
            production={report.annual_production_kwh}
            exported={report.energy_exported_kwh}
            imported={report.energy_imported_kwh}
          />
          <AutoconsumptionPieChart
            production={report.annual_production_kwh}
            exported={report.energy_exported_kwh}
          />
        </div>
      )}

      {/* Technical check */}
      <Section title="Kontrola techniczna">
        <CheckItem label="Ocena autokonsumpcji" value={report.autoconsumption_rating} />
        <CheckItem label="Stan paneli" value={report.panels_condition} />
        <CheckItem label="Mocowania" value={report.mounting_condition} />
        <CheckItem label="Przewody DC/AC" value={report.cables_condition} />
        <CheckItem label="Zabezpieczenia" value={report.protection_condition} />
        <CheckItem label="Odczyt falownika" value={report.inverter_reading} />
        <CheckItem label="Uziemienie" value={report.grounding_condition} />
        <CheckItem label="Możliwości rozbudowy" value={report.expansion_possibilities} />
        <CheckItem label="Potencjał modernizacji" value={report.modernization_potential} />
        <CheckItem label="Rekomendacje" value={report.recommendations} />
        <CheckItem label="Dodatkowe uwagi" value={report.additional_notes} />
      </Section>

      {/* Interview data */}
      <Section title="Wywiad z klientem">
        <CheckItem label="Roczny koszt energii" value={report.interview_annual_cost} />
        <CheckItem label="Liczba mieszkańców" value={report.interview_residents} />
        <CheckItem label="Wyjście do pracy/szkoły" value={report.interview_work_schedule} />
        <CheckItem label="Powrót do domu" value={report.interview_return_time} />
        <CheckItem label="Obecność w domu w dzień (10-15)" value={report.interview_home_during_day} />
        <CheckItem label="Największe zużycie" value={report.interview_peak_usage} />
        <CheckItem label="Używanie urządzeń" value={report.interview_appliance_usage} />
        <CheckItem label="Ogrzewanie wody" value={report.interview_water_heating} />
        <CheckItem label="Sprzęt elektryczny" value={report.interview_equipment} />
        <CheckItem label="Plany zakupowe" value={report.interview_purchase_plans} />
      </Section>

      {report.client_signature && (
        <Section title="Podpis">
          <div className="text-sm text-gray-900 italic">{report.client_signature}</div>
        </Section>
      )}
    </motion.div>
  );
}