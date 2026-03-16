import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

const eventTypeOptions = [
  { value: "meeting", label: "Spotkanie" },
  { value: "task", label: "Zadanie" },
  { value: "reminder", label: "Przypomnienie" },
  { value: "other", label: "Inne" },
];

const statusOptions = [
  { value: "planned", label: "Zaplanowane" },
  { value: "completed", label: "Zakończone" },
  { value: "cancelled", label: "Anulowane" },
];

export default function CalendarEventModal({ initialData, currentUser, onClose, onSaved }) {
  const isEdit = !!(initialData?.id);
  const [form, setForm] = useState({
    title: "",
    description: "",
    event_date: new Date().toISOString().split("T")[0],
    event_time: "",
    end_time: "",
    event_type: "meeting",
    status: "planned",
    client_name: "",
    client_phone: "",
    location: "",
    ...initialData,
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        ...data,
        owner_email: currentUser?.email || "",
        owner_name: currentUser?.displayName || currentUser?.full_name || "",
        source: "manual",
      };
      if (isEdit) {
        return base44.entities.CalendarEvent.update(initialData.id, payload);
      } else {
        return base44.entities.CalendarEvent.create(payload);
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Wydarzenie zaktualizowane" : "Wydarzenie dodane");
      onSaved();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edytuj wydarzenie" : "Nowe wydarzenie"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-3">
          <div>
            <Label>Tytuł *</Label>
            <Input value={form.title} onChange={e => set("title", e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Typ</Label>
              <Select value={form.event_type} onValueChange={v => set("event_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {eventTypeOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <Label>Data *</Label>
              <Input type="date" value={form.event_date} onChange={e => set("event_date", e.target.value)} required />
            </div>
            <div>
              <Label>Od</Label>
              <Input type="time" value={form.event_time} onChange={e => set("event_time", e.target.value)} />
            </div>
            <div>
              <Label>Do</Label>
              <Input type="time" value={form.end_time} onChange={e => set("end_time", e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Klient (opcjonalnie)</Label>
            <Input value={form.client_name} onChange={e => set("client_name", e.target.value)} placeholder="Imię i nazwisko klienta" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Telefon klienta</Label>
              <Input value={form.client_phone} onChange={e => set("client_phone", e.target.value)} />
            </div>
            <div>
              <Label>Lokalizacja</Label>
              <Input value={form.location} onChange={e => set("location", e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Opis</Label>
            <Textarea value={form.description} onChange={e => set("description", e.target.value)} rows={3} />
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={saveMutation.isPending} className="flex-1 bg-green-600 hover:bg-green-700">
              {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {isEdit ? "Zapisz zmiany" : "Dodaj wydarzenie"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Anuluj</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}