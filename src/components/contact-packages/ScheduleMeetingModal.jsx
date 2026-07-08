import React, { useState } from "react";
import { X, Calendar, Clock, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";

export default function ScheduleMeetingModal({ lead, currentUser, onClose, onSuccess }) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [timeEnd, setTimeEnd] = useState("");
  const [notes, setNotes] = useState(lead.contact_notes || "");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const handleSave = async () => {
    if (!date) return;
    setSaving(true);

    // 1. Utwórz wydarzenie w kalendarzu
    await base44.entities.CalendarEvent.create({
      title: `Spotkanie: ${lead.client_name}`,
      event_date: date,
      event_time: time || null,
      end_time: timeEnd || null,
      event_type: "meeting",
      status: "planned",
      client_name: lead.client_name,
      client_phone: lead.client_phone || "",
      location: lead.client_address || "",
      owner_email: currentUser.email,
      owner_name: currentUser.displayName || currentUser.full_name || "",
      source: "manual",
    });

    // 2. Zaktualizuj status leada i dopisz termin do notatki widocznej w paczce
    const meetingDateLabel = new Date(date).toLocaleDateString("pl-PL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const timeLabel = time ? (timeEnd ? `${time} - ${timeEnd}` : time) : "";
    const meetingNote = `Spotkanie umówione na: ${meetingDateLabel}${timeLabel ? ` w godz. ${timeLabel}` : ""}. Handlowiec: ${currentUser.displayName || currentUser.full_name || currentUser.email}`;
    const combinedNotes = notes?.trim() ? `${notes.trim()}\n\n${meetingNote}` : meetingNote;

    await base44.entities.ContactLead.update(lead.id, {
      status: "meeting_scheduled",
      contact_notes: combinedNotes,
      contacted_at: new Date().toISOString(),
      scheduled_meeting_date: date,
      scheduled_meeting_time: timeLabel,
    });

    setSaving(false);
    setDone(true);
  };

  const handleGoToReport = () => {
    // Przejdź do MeetingReports z prefill
    const params = new URLSearchParams({
      from_meeting: "1",
      prefill_client_name: lead.client_name || "",
      prefill_client_phone: lead.client_phone || "",
      prefill_client_address: lead.client_address || "",
      prefill_meeting_date: date,
      prefill_meeting_time: time || "",
    });
    window.location.hash = `/MeetingReports?${params.toString()}`;
    onSuccess();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-green-600" />
            Umów spotkanie
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {!done ? (
            <>
              {/* Klient info */}
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm font-semibold text-gray-900">{lead.client_name}</p>
                {lead.client_phone && <p className="text-xs text-gray-500 mt-0.5">{lead.client_phone}</p>}
                {lead.client_address && <p className="text-xs text-gray-400 mt-0.5">{lead.client_address}</p>}
              </div>

              {/* Data */}
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1.5">Data spotkania *</label>
                <Input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>

              {/* Godzina od-do */}
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1.5">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Godzina (opcjonalnie)</span>
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={time}
                    onChange={e => setTime(e.target.value)}
                  />
                  <span className="text-xs text-gray-400 shrink-0">do</span>
                  <Input
                    type="time"
                    value={timeEnd}
                    onChange={e => setTimeEnd(e.target.value)}
                    disabled={!time}
                  />
                </div>
              </div>

              {/* Notatki */}
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1.5">Notatki</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full resize-none focus:outline-none focus:ring-2 focus:ring-green-200"
                  placeholder="Ustalenia, uwagi..."
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={onClose} className="flex-1" disabled={saving}>Anuluj</Button>
                <Button
                  onClick={handleSave}
                  disabled={!date || saving}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                  {saving ? "Zapisuję..." : "Zapisz spotkanie"}
                </Button>
              </div>
            </>
          ) : (
            <div className="py-4 text-center space-y-4">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
              <div>
                <p className="font-semibold text-gray-900">Spotkanie zaplanowane!</p>
                <p className="text-sm text-gray-500 mt-1">
                  {new Date(date).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" })}
                  {time && ` w godz. ${time}${timeEnd ? ` - ${timeEnd}` : ""}`}
                </p>
                <p className="text-xs text-gray-400 mt-1">Wydarzenie dodano do kalendarza</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onSuccess} className="flex-1 text-sm">Zamknij</Button>
                <Button onClick={handleGoToReport} className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm">
                  Utwórz raport
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}