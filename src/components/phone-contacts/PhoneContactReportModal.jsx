import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, FileText, Plus, Pencil, CheckCircle2, Phone, Clock, Calendar, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { refreshReportingBlock } from "@/lib/refreshReportingBlock";

const resultConfig = {
  interested:        { label: "Zainteresowany",      color: "bg-green-100 text-green-700 border-green-300" },
  not_interested:    { label: "Niezainteresowany",   color: "bg-red-100 text-red-700 border-red-300" },
  no_answer:         { label: "Brak odpowiedzi",     color: "bg-gray-100 text-gray-600 border-gray-300" },
  callback:          { label: "Oddzwonić",           color: "bg-orange-100 text-orange-700 border-orange-300" },
  meeting_scheduled: { label: "Spotkanie umówione",  color: "bg-blue-100 text-blue-700 border-blue-300" },
  contract_signed:   { label: "Umowa podpisana",     color: "bg-emerald-100 text-emerald-800 border-emerald-400" },
  other:             { label: "Inne",                color: "bg-purple-100 text-purple-700 border-purple-300" },
};

function ReportForm({ contact, initialData, currentUser, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initialData || {
    contact_date: contact.contact_date || new Date().toISOString().split("T")[0],
    result: "other",
    description: "",
    next_steps: "",
    callback_date: "",
    meeting_date: "",
    meeting_time: "",
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Data kontaktu *</Label>
          <Input type="date" value={form.contact_date} onChange={e => setForm({ ...form, contact_date: e.target.value })} required />
        </div>
        <div>
          <Label>Data oddzwonienia</Label>
          <Input type="date" value={form.callback_date || ""} onChange={e => setForm({ ...form, callback_date: e.target.value })} />
        </div>
      </div>

      <div>
        <Label>Wynik kontaktu *</Label>
        <div className="grid grid-cols-2 gap-2 mt-1">
          {Object.entries(resultConfig).map(([key, cfg]) => (
            <button
              key={key}
              type="button"
              onClick={() => setForm({ ...form, result: key })}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all text-left ${
                form.result === key ? cfg.color : "border-gray-200 text-gray-600 hover:border-gray-300 bg-white"
              }`}
            >
              {cfg.label}
            </button>
          ))}
        </div>
      </div>

      {form.result === "meeting_scheduled" && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700">
            <Calendar className="w-3.5 h-3.5" />
            Umówione spotkanie — dodaj do kalendarza
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data spotkania *</Label>
              <Input type="date" value={form.meeting_date || ""} onChange={e => setForm({ ...form, meeting_date: e.target.value })} required />
            </div>
            <div>
              <Label>Godzina spotkania</Label>
              <Input type="time" value={form.meeting_time || ""} onChange={e => setForm({ ...form, meeting_time: e.target.value })} />
            </div>
          </div>
          <p className="text-[11px] text-blue-600">Spotkanie pojawi się w Twoim kalendarzu, żebyś o nim nie zapomniał.</p>
        </div>
      )}

      <div>
        <Label>Notatki z rozmowy</Label>
        <Textarea
          value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })}
          rows={4}
          placeholder="Co omówiono, reakcja klienta, ważne informacje..."
        />
      </div>

      <div>
        <Label>Kolejne kroki</Label>
        <Textarea
          value={form.next_steps}
          onChange={e => setForm({ ...form, next_steps: e.target.value })}
          rows={2}
          placeholder="Co należy zrobić dalej..."
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={saving} className="flex-1 bg-green-600 hover:bg-green-700">
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Zapisz raport
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>Anuluj</Button>
      </div>
    </form>
  );
}

export default function PhoneContactReportModal({ contact, currentUser, open, onClose, startInCreate = false }) {
  const queryClient = useQueryClient();
  const [view, setView] = useState(startInCreate ? "create" : "list"); // list | create | edit
  const [editingReport, setEditingReport] = useState(null);
  const [reportSaved, setReportSaved] = useState(false);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["phoneContactReports", contact?.contact_key],
    queryFn: () => base44.entities.PhoneContactReport.filter({ contact_key: contact.contact_key }),
    enabled: !!contact?.contact_key && open,
  });

  // Powiązane wydarzenia kalendarza (spotkania umówione z tego kontaktu) — do edycji daty/godziny
  const { data: linkedEvents = [] } = useQuery({
    queryKey: ["phoneReportCalendarEvents", currentUser?.email],
    queryFn: () => base44.entities.CalendarEvent.filter({ owner_email: currentUser?.email || "" }),
    enabled: !!currentUser?.email && open,
  });

  const getLinkedEventForReport = (reportId) =>
    linkedEvents.find(e => (e.description || "").includes(`[link:phone_report:${reportId}]`));

  const sortedReports = useMemo(() => {
    return [...reports].sort((a, b) => (b.contact_date || "").localeCompare(a.contact_date || ""));
  }, [reports]);

  const buildMeetingEventPayload = (meetingDate, meetingTime, reportId) => ({
    title: `📞🤝 ${contact.client_name}`,
    description: `Spotkanie umówione z kontaktu telefonicznego.\n[link:phone_report:${reportId}]`,
    event_date: meetingDate,
    event_time: meetingTime || "",
    event_type: "meeting",
    status: "planned",
    client_name: contact.client_name,
    client_phone: contact.phone || contact.client_phone || "",
    location: contact.address || contact.client_address || "",
    owner_email: currentUser?.email || "",
    owner_name: currentUser?.displayName || currentUser?.full_name || "",
    source: "manual",
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const { meeting_date, meeting_time, ...reportData } = data;
      const report = await base44.entities.PhoneContactReport.create({
        ...reportData,
        contact_key: contact.contact_key,
        client_name: contact.client_name,
        client_phone: contact.phone || contact.client_phone || "",
        client_address: contact.address || contact.client_address || "",
        author_name: currentUser?.displayName || currentUser?.full_name || "",
        author_email: currentUser?.email || "",
      });
      if (reportData.result === "meeting_scheduled" && meeting_date) {
        await base44.entities.CalendarEvent.create(buildMeetingEventPayload(meeting_date, meeting_time, report.id));
      }
      return report;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["phoneContactReports", contact.contact_key] });
      queryClient.invalidateQueries({ queryKey: ["calendarEvents"] });
      toast.success("Raport zapisany");
      setReportSaved(true);
      setView("list");
      refreshReportingBlock();
    },
    onError: (err) => {
      toast.error("Nie udało się zapisać raportu: " + (err?.message || "nieznany błąd"));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const { meeting_date, meeting_time, ...reportData } = data;
      const report = await base44.entities.PhoneContactReport.update(id, reportData);
      const marker = `[link:phone_report:${id}]`;
      const existingEvents = await base44.entities.CalendarEvent.filter({ owner_email: currentUser?.email || "" });
      const linkedEvent = existingEvents.find(e => (e.description || "").includes(marker));
      if (reportData.result === "meeting_scheduled" && meeting_date) {
        const payload = buildMeetingEventPayload(meeting_date, meeting_time, id);
        if (linkedEvent) {
          await base44.entities.CalendarEvent.update(linkedEvent.id, payload);
        } else {
          await base44.entities.CalendarEvent.create(payload);
        }
      } else if (linkedEvent) {
        await base44.entities.CalendarEvent.delete(linkedEvent.id);
      }
      return report;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["phoneContactReports", contact.contact_key] });
      queryClient.invalidateQueries({ queryKey: ["calendarEvents"] });
      toast.success("Raport zaktualizowany");
      setReportSaved(true);
      setView("list");
      setEditingReport(null);
      refreshReportingBlock();
    },
    onError: (err) => {
      toast.error("Nie udało się zaktualizować raportu: " + (err?.message || "nieznany błąd"));
    },
  });

  const handleClose = () => {
    const saved = reportSaved;
    setView(startInCreate ? "create" : "list");
    setEditingReport(null);
    setReportSaved(false);
    onClose?.(saved);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {(view === "create" || view === "edit") && (
              <button onClick={() => { setView("list"); setEditingReport(null); }} className="mr-1">
                <ArrowLeft className="w-4 h-4 text-gray-500" />
              </button>
            )}
            <FileText className="w-4 h-4 text-green-600" />
            Raporty — {contact?.client_name}
          </DialogTitle>
          {contact?.phone && (
            <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
              <Phone className="w-3 h-3" /> {contact.phone}
              {contact.address && <span className="ml-2">{contact.address}</span>}
            </div>
          )}
        </DialogHeader>

        {view === "list" && (
          <div className="space-y-3 mt-2">
            <Button onClick={() => setView("create")} className="w-full bg-green-600 hover:bg-green-700 gap-2">
              <Plus className="w-4 h-4" /> Nowy raport
            </Button>

            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
            ) : reports.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">Brak raportów dla tego kontaktu</div>
            ) : (
              <div className="space-y-2">
                {sortedReports.map(r => {
                  const cfg = resultConfig[r.result] || resultConfig.other;
                  return (
                    <div key={r.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cfg.color}`}>{cfg.label}</Badge>
                            {r.contact_date && (
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(r.contact_date).toLocaleDateString("pl-PL")}
                              </span>
                            )}
                            {r.callback_date && (
                              <span className="text-xs text-orange-600 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Oddzwonić: {new Date(r.callback_date).toLocaleDateString("pl-PL")}
                              </span>
                            )}
                          </div>
                          {r.description && <p className="text-xs text-gray-700 mt-1 whitespace-pre-wrap">{r.description}</p>}
                          {r.next_steps && <p className="text-xs text-blue-600 mt-1">→ {r.next_steps}</p>}
                          {r.author_name && <p className="text-[10px] text-gray-400 mt-1">{r.author_name}</p>}
                        </div>
                        <button
                          onClick={() => { setEditingReport(r); setView("edit"); }}
                          className="shrink-0 p-1.5 rounded hover:bg-gray-200 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {view === "create" && (
          <div className="mt-2">
            <ReportForm
              contact={contact}
              currentUser={currentUser}
              onSave={(data) => createMutation.mutate(data)}
              onCancel={() => setView("list")}
              saving={createMutation.isPending}
            />
          </div>
        )}

        {view === "edit" && editingReport && (
          <div className="mt-2">
            <ReportForm
              contact={contact}
              currentUser={currentUser}
              initialData={{
                ...editingReport,
                meeting_date: getLinkedEventForReport(editingReport.id)?.event_date || "",
                meeting_time: getLinkedEventForReport(editingReport.id)?.event_time || "",
              }}
              onSave={(data) => updateMutation.mutate({ id: editingReport.id, data })}
              onCancel={() => { setView("list"); setEditingReport(null); }}
              saving={updateMutation.isPending}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}