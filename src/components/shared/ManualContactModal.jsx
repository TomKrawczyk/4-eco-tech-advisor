import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";

const SOURCE_TYPES = [
  { value: "spotkanie", label: "Spotkanie" },
  { value: "kontakt_telefoniczny", label: "Kontakt telefoniczny" },
  { value: "facebook", label: "Facebook" },
  { value: "infolinia", label: "Kontakt z infolinii" },
];

export default function ManualContactModal({ open, onOpenChange, currentUser, groups, salespeople }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    source_type: "",
    client_name: "",
    client_phone: "",
    client_address: "",
    date: new Date().toISOString().split("T")[0],
    time: "",
    notes: "",
    assigned_user_email: "",
    assigned_group_id: "",
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const resetForm = () => setForm({
    source_type: "", client_name: "", client_phone: "", client_address: "",
    date: new Date().toISOString().split("T")[0], time: "", notes: "",
    assigned_user_email: "", assigned_group_id: "",
  });

  const handleSave = async () => {
    if (!form.source_type || !form.client_name.trim()) return;
    setSaving(true);

    try {
      const isMeeting = form.source_type === "spotkanie";
      const userEmail = form.assigned_user_email && form.assigned_user_email !== "__none__" ? form.assigned_user_email : "";
      const groupId = form.assigned_group_id && form.assigned_group_id !== "__none__" ? form.assigned_group_id : "";
      const assignedUser = salespeople?.find(s => s.email === userEmail);
      const assignedGroup = groups?.find(g => g.id === groupId);

      if (isMeeting) {
        const meetingCalendar = form.date && form.time
          ? `${form.date.split("-").reverse().join(".")} ${form.time}`
          : form.date?.split("-").reverse().join(".") || "";
        const key = `manual__${form.client_name.trim()}__${Date.now()}`;
        await base44.entities.MeetingAssignment.create({
          meeting_key: key,
          sheet: `Ręczne (${SOURCE_TYPES.find(s => s.value === form.source_type)?.label || form.source_type})`,
          client_name: form.client_name.trim(),
          client_phone: form.client_phone,
          client_address: form.client_address,
          meeting_calendar: meetingCalendar,
          meeting_date: form.date || "",
          notes: form.notes,
          assigned_user_email: userEmail,
          assigned_user_name: assignedUser?.name || "",
          assigned_group_id: groupId,
          assigned_group_name: assignedGroup?.name || "",
        });
        queryClient.invalidateQueries({ queryKey: ["meetingAssignments"] });
      } else {
        const key = `manual__${form.client_name.trim()}__${Date.now()}`;
        await base44.entities.PhoneContact.create({
          contact_key: key,
          sheet: `Ręczne (${SOURCE_TYPES.find(s => s.value === form.source_type)?.label || form.source_type})`,
          client_name: form.client_name.trim(),
          phone: form.client_phone,
          address: form.client_address,
          contact_date: form.date || "",
          status: "Kontakt do doradcy",
          comments: form.notes,
          assigned_user_email: userEmail,
          assigned_user_name: assignedUser?.name || "",
          assigned_group_id: groupId,
          assigned_group_name: assignedGroup?.name || "",
        });
        queryClient.invalidateQueries({ queryKey: ["phoneContactsDB"] });
      }

      resetForm();
      onOpenChange(false);
    } catch (err) {
      alert("Błąd podczas zapisywania: " + (err?.message || "Nieznany błąd. Spróbuj ponownie."));
    } finally {
      setSaving(false);
    }
  };

  const isMeeting = form.source_type === "spotkanie";
  const canSave = form.source_type && form.client_name.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dodaj ręcznie</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Typ */}
          <div className="space-y-1.5">
            <Label>Typ kontaktu *</Label>
            <div className="grid grid-cols-2 gap-2">
              {SOURCE_TYPES.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => set("source_type", s.value)}
                  className={`rounded-lg border px-3 py-2.5 text-sm font-medium text-left transition-all ${
                    form.source_type === s.value
                      ? "border-green-500 bg-green-50 text-green-700"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Imię klienta */}
          <div className="space-y-1.5">
            <Label>Imię i nazwisko klienta *</Label>
            <Input
              value={form.client_name}
              onChange={e => set("client_name", e.target.value)}
              placeholder="Jan Kowalski"
            />
          </div>

          {/* Telefon */}
          <div className="space-y-1.5">
            <Label>Telefon</Label>
            <Input
              value={form.client_phone}
              onChange={e => set("client_phone", e.target.value)}
              placeholder="+48 000 000 000"
              type="tel"
            />
          </div>

          {/* Adres */}
          <div className="space-y-1.5">
            <Label>Adres</Label>
            <Input
              value={form.client_address}
              onChange={e => set("client_address", e.target.value)}
              placeholder="ul. Przykładowa 1, Warszawa"
            />
          </div>

          {/* Data + godzina (dla spotkania godzina) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{isMeeting ? "Data spotkania" : "Data kontaktu"}</Label>
              <Input
                type="date"
                value={form.date}
                onChange={e => set("date", e.target.value)}
              />
            </div>
            {isMeeting && (
              <div className="space-y-1.5">
                <Label>Godzina</Label>
                <Input
                  type="time"
                  value={form.time}
                  onChange={e => set("time", e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Notatki */}
          <div className="space-y-1.5">
            <Label>Notatki</Label>
            <Input
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
              placeholder="Dodatkowe informacje..."
            />
          </div>

          {/* Przypisanie do doradcy */}
          {salespeople && salespeople.length > 0 && (
            <div className="space-y-1.5">
              <Label>Przypisz do doradcy</Label>
              <Select value={form.assigned_user_email} onValueChange={val => set("assigned_user_email", val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Nie przypisuj (opcjonalne)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nie przypisuj</SelectItem>
                  {salespeople.map(s => (
                    <SelectItem key={s.email} value={s.email}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Przypisanie do grupy */}
          {groups && groups.length > 0 && (currentUser?.role === "admin") && (
            <div className="space-y-1.5">
              <Label>Przypisz do grupy</Label>
              <Select value={form.assigned_group_id} onValueChange={val => set("assigned_group_id", val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Nie przypisuj (opcjonalne)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Nie przypisuj</SelectItem>
                  {groups.map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Anuluj</Button>
          <Button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {saving ? "Zapisywanie..." : "Zapisz"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}