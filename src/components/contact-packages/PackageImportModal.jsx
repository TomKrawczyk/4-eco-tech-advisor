import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";

// Mapowanie możliwych nagłówków kolumn w Excelu
const COLUMN_MAP = {
  client_name: ["imię i nazwisko", "imie i nazwisko", "nazwa", "klient", "name", "client_name", "imię", "imie", "nazwisko"],
  client_phone: ["telefon", "tel", "phone", "numer", "numer telefonu", "client_phone"],
  client_address: ["adres", "address", "client_address", "miejscowość", "miejscowosc", "miasto"],
  notes: ["notatki", "uwagi", "notes", "komentarz", "comments", "info"],
};

function matchHeader(header) {
  const h = header?.toString().toLowerCase().trim();
  for (const [field, aliases] of Object.entries(COLUMN_MAP)) {
    if (aliases.some(a => h.includes(a))) return field;
  }
  return null;
}

function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb = XLSX.read(e.target.result, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      if (rows.length < 2) { reject(new Error("Plik jest pusty lub nie ma danych.")); return; }

      // Pierwsza niepusta linia jako nagłówki
      const headers = rows[0].map(h => h?.toString() || "");
      const fieldMap = headers.map(matchHeader);

      const contacts = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.every(c => !c)) continue;
        const contact = {};
        fieldMap.forEach((field, idx) => {
          if (field && row[idx] !== undefined && row[idx] !== "") {
            contact[field] = row[idx]?.toString().trim();
          }
        });
        // Jeśli nie znaleźliśmy client_name automatycznie, bierz pierwszą kolumnę
        if (!contact.client_name && row[0]) {
          contact.client_name = row[0]?.toString().trim();
        }
        if (contact.client_name) contacts.push(contact);
      }
      resolve({ contacts, headers, fieldMap });
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}

export default function PackageImportModal({ currentUser, onClose, onSuccess }) {
  const [step, setStep] = useState("form"); // form | preview | importing | done
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [parseError, setParseError] = useState("");
  const [progress, setProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const fileRef = useRef();

  const handleFileChange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setParseError("");
    try {
      const { contacts: parsed } = await parseExcel(f);
      setContacts(parsed);
    } catch (err) {
      setParseError(err.message || "Błąd odczytu pliku.");
      setContacts([]);
    }
  };

  const handleImport = async () => {
    if (!name.trim() || contacts.length === 0) return;
    setStep("importing");
    setProgress(0);

    // Utwórz paczkę
    const pkg = await base44.entities.ContactPackage.create({
      name: name.trim(),
      description: description.trim(),
      group_id: currentUser.groupId,
      group_name: currentUser.groupName || "",
      created_by_email: currentUser.email,
      created_by_name: currentUser.displayName || currentUser.full_name || "",
      total_count: contacts.length,
      assigned_count: 0,
      status: "active",
    });

    // Bulk insert kontaktów partiami po 50
    const BATCH = 50;
    let done = 0;
    for (let i = 0; i < contacts.length; i += BATCH) {
      const batch = contacts.slice(i, i + BATCH).map(c => ({
        ...c,
        package_id: pkg.id,
        group_id: currentUser.groupId,
        status: "unassigned",
      }));
      await base44.entities.ContactLead.bulkCreate(batch);
      done += batch.length;
      setProgress(Math.round((done / contacts.length) * 100));
    }
    setImportedCount(done);
    setStep("done");
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Importuj paczkę kontaktów</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {step === "form" && (
            <>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Nazwa paczki *</label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="np. Kontakty kwiecień 2026"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Opis (opcjonalny)</label>
                <Input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="np. Rejon Kraków, kampania wiosenna"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Plik Excel (.xlsx, .xls, .csv) *</label>
                <div
                  className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-green-300 transition-colors cursor-pointer"
                  onClick={() => fileRef.current?.click()}
                >
                  {file ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileSpreadsheet className="w-8 h-8 text-green-600" />
                      <p className="text-sm font-medium text-gray-900">{file.name}</p>
                      <p className="text-xs text-gray-500">{contacts.length} kontaktów wczytanych</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-8 h-8 text-gray-300" />
                      <p className="text-sm text-gray-500">Kliknij aby wybrać plik Excel</p>
                      <p className="text-xs text-gray-400">Obsługiwane kolumny: imię i nazwisko, telefon, adres, notatki</p>
                    </div>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
                {parseError && (
                  <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />{parseError}
                  </p>
                )}
              </div>

              {/* Podgląd pierwszych wierszy */}
              {contacts.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Podgląd (pierwsze 5 wierszy):</p>
                  <div className="overflow-x-auto rounded-lg border border-gray-100">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-3 py-2 text-left text-gray-500 font-medium">Imię i nazwisko</th>
                          <th className="px-3 py-2 text-left text-gray-500 font-medium">Telefon</th>
                          <th className="px-3 py-2 text-left text-gray-500 font-medium">Adres</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contacts.slice(0, 5).map((c, i) => (
                          <tr key={i} className="border-t border-gray-50">
                            <td className="px-3 py-2 text-gray-900">{c.client_name || "—"}</td>
                            <td className="px-3 py-2 text-gray-600">{c.client_phone || "—"}</td>
                            <td className="px-3 py-2 text-gray-600 truncate max-w-[120px]">{c.client_address || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {contacts.length > 5 && (
                    <p className="text-xs text-gray-400 mt-1 text-center">… i {contacts.length - 5} więcej</p>
                  )}
                </div>
              )}
            </>
          )}

          {step === "importing" && (
            <div className="flex flex-col items-center py-8 gap-4">
              <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
              <p className="font-medium text-gray-900">Importowanie kontaktów…</p>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-sm text-gray-500">{progress}% ({Math.round(contacts.length * progress / 100)} / {contacts.length})</p>
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center py-8 gap-4 text-center">
              <CheckCircle className="w-12 h-12 text-green-500" />
              <p className="text-lg font-bold text-gray-900">Import zakończony!</p>
              <p className="text-sm text-gray-500">Zaimportowano <strong>{importedCount}</strong> kontaktów do paczki <strong>{name}</strong>.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          {step === "form" && (
            <>
              <Button variant="outline" onClick={onClose}>Anuluj</Button>
              <Button
                onClick={handleImport}
                disabled={!name.trim() || contacts.length === 0}
                className="bg-green-600 hover:bg-green-700 text-white gap-2"
              >
                <Upload className="w-4 h-4" />
                Importuj {contacts.length > 0 ? `(${contacts.length})` : ""}
              </Button>
            </>
          )}
          {step === "done" && (
            <Button onClick={onSuccess} className="bg-green-600 hover:bg-green-700 text-white">
              Gotowe
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}