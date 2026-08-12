import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Pencil, Check, X } from "lucide-react";

// Edycja handlowców przypisanych do paczki prywatnej (max 2) — tylko admin
export default function PrivateAssigneesEditor({ pkg, salesUsers, onSaved }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const currentEmails = pkg.assigned_user_emails?.length
    ? pkg.assigned_user_emails
    : (pkg.assigned_user_email ? [pkg.assigned_user_email] : []);
  const [email1, setEmail1] = useState(currentEmails[0] || "");
  const [email2, setEmail2] = useState(currentEmails[1] || "");

  const saveMutation = useMutation({
    mutationFn: () => {
      const emails = [email1, email2].filter(Boolean).filter((e, i, a) => a.indexOf(e) === i);
      const names = emails.map(e => salesUsers.find(u => u.email === e)?.name || e);
      return base44.entities.ContactPackage.update(pkg.id, {
        assigned_user_emails: emails,
        assigned_user_email: emails[0] || "",
        assigned_user_name: names.join(", "),
      });
    },
    onSuccess: async () => {
      setEditing(false);
      await qc.refetchQueries({ queryKey: ["contact-packages"] });
      if (onSaved) onSaved();
    },
    onError: (err) => alert("Nie udało się zapisać handlowców: " + (err?.message || "Nieznany błąd")),
  });

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors"
      >
        <Pencil className="w-3 h-3" />
        {pkg.assigned_user_name ? `Handlowcy: ${pkg.assigned_user_name}` : "Brak handlowców — kliknij aby przypisać"}
      </button>
    );
  }

  const renderSelect = (value, setValue, placeholder) => (
    <select
      value={value}
      onChange={e => setValue(e.target.value)}
      className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-green-200 max-w-[220px]"
    >
      <option value="">{placeholder}</option>
      {salesUsers.map(u => (
        <option key={u.email} value={u.email}>{u.name} ({u.email})</option>
      ))}
    </select>
  );

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {renderSelect(email1, setEmail1, "— handlowiec 1 —")}
      {renderSelect(email2, setEmail2, "— handlowiec 2 (opcjonalnie) —")}
      <button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="p-1 rounded hover:bg-green-50 text-green-600"
        title="Zapisz"
      >
        <Check className="w-4 h-4" />
      </button>
      <button
        onClick={() => { setEditing(false); setEmail1(currentEmails[0] || ""); setEmail2(currentEmails[1] || ""); }}
        className="p-1 rounded hover:bg-gray-100 text-gray-400"
        title="Anuluj"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}