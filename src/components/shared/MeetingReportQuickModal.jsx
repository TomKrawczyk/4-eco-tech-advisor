import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { Loader2, Calendar, MapPin, Phone, FileText } from "lucide-react";
import { toast } from "sonner";
import { refreshReportingBlock } from "@/lib/refreshReportingBlock";

const statusConfig = {
  completed: { label: "Spotkanie odbyło się", color: "bg-green-100 text-green-700 border-green-300" },
  cancelled: { label: "Spotkanie odwołane", color: "bg-red-100 text-red-700 border-red-300" },
};

// Szybki modal raportu po spotkaniu — do uzupełniania zaległości bezpośrednio z ekranu blokady.
// Tworzy MeetingReport z prefilled danymi klienta i od razu przelicza blokadę.
export default function MeetingReportQuickModal({ meeting, currentUser, open, onClose }) {
  const [status, setStatus] = useState("completed");
  const [description, setDescription] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [saving, setSaving] = useState(false);

  if (!meeting) return null;

  const meetingDate = meeting.meeting_date || (meeting.meeting_calendar || "").match(/\d{4}-\d{2}-\d{2}/)?.[0] || "";
  const meetingTime = (meeting.meeting_calendar || "").match(/(\d{1,2}:\d{2})/)?.[1] || "";

  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (status === "completed" && !description.trim()) {
      toast.error("Uzupełnij opis spotkania");
      return;
    }
    setSaving(true);
    try {
      await base44.entities.MeetingReport.create({
        client_name: meeting.client_name || "",
        client_phone: meeting.client_phone || meeting.phone || "",
        client_address: meeting.client_address || meeting.address || "",
        meeting_date: meetingDate || new Date().toISOString().split("T")[0],
        meeting_time: meetingTime || "",
        description: description.trim(),
        next_steps: nextSteps.trim(),
        status,
        author_name: currentUser?.displayName || currentUser?.full_name || "",
        author_email: currentUser?.email || "",
      });
      toast.success("Raport zapisany — przeliczam blokadę");
      refreshReportingBlock();
      setDescription("");
      setNextSteps("");
      setStatus("completed");
      onClose?.(true);
    } catch (err) {
      toast.error("Nie udało się zapisać: " + (err?.message || "nieznany błąd"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.(false)}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-green-600" />
            Raport po spotkaniu
          </DialogTitle>
        </DialogHeader>

        {/* Dane klienta — read-only */}
        <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-sm">
          <div className="font-semibold text-gray-900">{meeting.client_name || "Klient"}</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
            {meetingDate && (
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {meetingDate}{meetingTime ? ` ${meetingTime}` : ""}</span>
            )}
            {(meeting.client_phone || meeting.phone) && (
              <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {meeting.client_phone || meeting.phone}</span>
            )}
          </div>
          {(meeting.client_address || meeting.address) && (
            <div className="flex items-center gap-1 text-xs text-gray-600"><MapPin className="w-3 h-3" /> {meeting.client_address || meeting.address}</div>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Status spotkania */}
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Status spotkania</div>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(statusConfig).map(([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatus(key)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border text-left transition-all ${
                    status === key ? cfg.color : "border-gray-200 text-gray-600 hover:border-gray-300 bg-white"
                  }`}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {status === "completed" && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Opis spotkania *</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Co omówiono na spotkaniu, reakcja klienta, ważne informacje..."
                autoFocus
              />
            </div>
          )}

          {status === "cancelled" && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Powód odwołania</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Dlaczego spotkanie nie odbyło się..."
                autoFocus
              />
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Kolejne kroki</label>
            <Textarea
              value={nextSteps}
              onChange={(e) => setNextSteps(e.target.value)}
              rows={2}
              placeholder="Co należy zrobić dalej..."
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={saving} className="flex-1 bg-green-600 hover:bg-green-700">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Zapisz raport
            </Button>
            <Button type="button" variant="outline" onClick={() => onClose?.(false)}>Anuluj</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}