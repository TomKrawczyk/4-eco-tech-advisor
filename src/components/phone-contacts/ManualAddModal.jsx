import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, Calendar, Facebook, PhoneCall, Loader2 } from "lucide-react";

const SOURCE_TYPES = [
  { value: "infolinia", label: "Infolinia", icon: PhoneCall },
  { value: "facebook", label: "Facebook", icon: Facebook },
];

export default function ManualAddModal({ open, onClose, currentUser, onContactAdded }) {
  const [type, setType] = useState("contact"); // "contact" | "meeting"
  const [source, setSource] = useState("infolinia");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    client_name: "",
    client_phone: "",
    client_address: "",
    contact_date: new Date().toISOString().split("T")[0],
    description: "",
    // meeting-only
    meeting_time: "",
    end_time: "",
  });

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!form.client_name) return;
    setSaving(true);

    if (type === "contact") {
      const contactKey = `manual_${source}_${form.client_name}_${form.contact_date}_${Date.now()}`;
      await base44.entities.PhoneContact.create({
        contact_key: contactKey,
        sheet: source === "facebook" ? "Facebook" : "Infolinia",
        client_name: form.client_name,
        phone: form.client_phone,
        address: form.client_address,
        contact_date: form.contact_date,
        date: form.contact_date,
        status: "Kontakt do doradcy",
        comments: form.description,
      });
    } else {
      // Spotkanie do kalendarza
      await base44.entities.CalendarEvent.create({
        title: form.client_name,
        client_name: form.client_name,
        client_phone: form.client_phone,
        location: form.client_address,
        event_date: form.contact_date,
        event_time: form.meeting_time || "",
        end_time: form.end_time || "",
        description: form.description,
        event_type: "meeting",
        status: "planned",
        source: "manual",
        owner_email: currentUser?.email || "",
        owner_name: currentUser?.displayName || currentUser?.full_name || "",
      });
    }

    setSaving(false);
    onContactAdded?.();
    onClose();
    resetForm();
  };

  const resetForm = () => {
    setForm({
      client_name: "",
      client_phone: "",
      client_address: "",
      contact_date: new Date().toISOString().split("T")[0],
      description: "",
      meeting_time: "",
      end_time: "",
    });
    setType("contact");
    setSource("infolinia");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); resetForm(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dodaj ręcznie</DialogTitle>
        </DialogHeader>

        {/* Wybór typu */}
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setType("contact")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border transition-all ${
              type === "contact"
                ? "bg-green-50 border-green-400 text-green-700"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Phone className="w-4 h-4" />
            Kontakt telefoniczny
          </button>
          <button
            type="button"
            onClick={() => setType("meeting")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border transition-all ${
              type === "meeting"
                ? "bg-blue-50 border-blue-400 text-blue-700"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Calendar className="w-4 h-4" />
            Spotkanie
          </button>
        </div>

        <div className="space-y-3">
          {/* Źródło – tylko dla kontaktu */}
          {type === "contact" && (
            <div>
              <Label className="mb-1 block">Źródło</Label>
              <div className="flex gap-2">
                {SOURCE_TYPES.map(s => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setSource(s.value)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-all ${
                        source === s.value
                          ? "bg-orange-50 border-orange-400 text-orange-700"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <Label className="mb-1 block">Imię i nazwisko klienta *</Label>
            <Input
              value={form.client_name}
              onChange={e => set("client_name", e.target.value)}
              placeholder="Jan Kowalski"
            />
          </div>

          <div>
            <Label className="mb-1 block">Telefon</Label>
            <Input
              value={form.client_phone}
              onChange={e => set("client_phone", e.target.value)}
              placeholder="+48 000 000 000"
            />
          </div>

          <div>
            <Label className="mb-1 block">Adres</Label>
            <Input
              value={form.client_address}
              onChange={e => set("client_address", e.target.value)}
              placeholder="ul. Przykładowa 1, Warszawa"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block">{type === "meeting" ? "Data spotkania" : "Data kontaktu"}</Label>
              <Input
                type="date"
                value={form.contact_date}
                onChange={e => set("contact_date", e.target.value)}
              />
            </div>
            {type === "meeting" && (
              <>
                <div>
                  <Label className="mb-1 block">Godzina</Label>
                  <Input
                    type="time"
                    value={form.meeting_time}
                    onChange={e => set("meeting_time", e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          <div>
            <Label className="mb-1 block">Notatki / Opis</Label>
            <Textarea
              value={form.description}
              onChange={e => set("description", e.target.value)}
              rows={3}
              placeholder="Dodatkowe informacje..."
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleSave}
            disabled={saving || !form.client_name}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Zapisz
          </Button>
          <Button variant="outline" onClick={() => { onClose(); resetForm(); }}>
            Anuluj
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}