import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";

// ─── Inteligentne dopasowanie kolumn ───────────────────────────────────────────
// Zwraca index kolumny lub -1
function findCol(headers, keywords) {
  const norm = h => h?.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  return headers.findIndex(h => keywords.some(k => norm(h).includes(norm(k))));
}

const PHONE_RE = /^(\+?48)?[\s-]?(\d[\s-]?){9,}$/;
const LOOKS_LIKE_PHONE = (v) => PHONE_RE.test(v?.toString().replace(/\s/g, ""));
const LOOKS_LIKE_NAME = (v) => {
  const s = v?.toString().trim() || "";
  return s.length > 3 && /[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(s) && !LOOKS_LIKE_PHONE(s);
};
const LOOKS_LIKE_ADDRESS = (v) => {
  const s = v?.toString().trim() || "";
  return s.length > 3 && /\d/.test(s) && /[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(s);
};

function detectColumns(headers, sampleRows) {
  // Najpierw po nagłówkach
  let nameIdx = findCol(headers, ["imię i nazwisko", "imie i nazwisko", "nazwisko", "nazwa", "klient", "name", "imię", "imie", "pesel"]);
  let phoneIdx = findCol(headers, ["telefon", "tel", "phone", "numer", "komórka", "komorka", "mobile", "gsm"]);
  let addressIdx = findCol(headers, ["adres", "address", "miejscowość", "miejscowosc", "miasto", "ulica", "lokalizacja"]);
  let notesIdx = findCol(headers, ["notatki", "uwagi", "notes", "komentarz", "comments", "info", "opis"]);

  // Jeśli nie znaleziono po nagłówkach — wykryj po zawartości (pierwsze 10 wierszy)
  if (nameIdx === -1 || phoneIdx === -1) {
    const colScores = headers.map((_, ci) => {
      const vals = sampleRows.map(r => r[ci]).filter(Boolean);
      return {
        phoneScore: vals.filter(LOOKS_LIKE_PHONE).length,
        nameScore: vals.filter(LOOKS_LIKE_NAME).length,
        addressScore: vals.filter(LOOKS_LIKE_ADDRESS).length,
      };
    });

    if (phoneIdx === -1) {
      const best = colScores.reduce((bi, s, i) => s.phoneScore > colScores[bi].phoneScore ? i : bi, 0);
      if (colScores[best].phoneScore > 0) phoneIdx = best;
    }
    if (nameIdx === -1) {
      const best = colScores.reduce((bi, s, i) =>
        i !== phoneIdx && s.nameScore > colScores[bi].nameScore ? i : bi, 0);
      if (colScores[best].nameScore > 0) nameIdx = best;
    }
    if (addressIdx === -1) {
      const best = colScores.reduce((bi, s, i) =>
        i !== phoneIdx && i !== nameIdx && s.addressScore > colScores[bi].addressScore ? i : bi, 0);
      if (colScores[best].addressScore > 0) addressIdx = best;
    }
  }

  return { nameIdx, phoneIdx, addressIdx, notesIdx };
}

function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

        if (rows.length < 2) { reject(new Error("Plik jest pusty lub nie ma danych.")); return; }

        // Sprawdź czy pierwsza linia to nagłówki (czy zawiera tekst)
        const firstRow = rows[0].map(c => c?.toString() || "");
        const hasHeaders = firstRow.some(h => /[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(h));
        const headers = hasHeaders ? firstRow : firstRow.map((_, i) => `Kolumna ${i + 1}`);
        const dataRows = hasHeaders ? rows.slice(1) : rows;

        const sampleRows = dataRows.slice(0, 15);
        const { nameIdx, phoneIdx, addressIdx, notesIdx } = detectColumns(headers, sampleRows);

        const contacts = [];
        for (const row of dataRows) {
          if (row.every(c => c === "" || c === null || c === undefined)) continue;

          const contact = {};
          if (nameIdx >= 0 && row[nameIdx]) contact.client_name = row[nameIdx].toString().trim();
          if (phoneIdx >= 0 && row[phoneIdx]) contact.client_phone = row[phoneIdx].toString().trim();
          if (addressIdx >= 0 && row[addressIdx]) contact.client_address = row[addressIdx].toString().trim();
          if (notesIdx >= 0 && row[notesIdx]) contact.notes = row[notesIdx].toString().trim();

          // Fallback — jeśli nadal nie mamy imienia, bierz pierwszą niepustą kolumnę tekstową
          if (!contact.client_name) {
            const fallback = row.find(c => LOOKS_LIKE_NAME(c));
            if (fallback) contact.client_name = fallback.toString().trim();
          }
          // Fallback dla telefonu
          if (!contact.client_phone) {
            const fallback = row.find(c => LOOKS_LIKE_PHONE(c));
            if (fallback) contact.client_phone = fallback.toString().trim();
          }

          if (contact.client_name || contact.client_phone) contacts.push(contact);
        }

        resolve({
          contacts,
          mapping: { nameIdx, phoneIdx, addressIdx, notesIdx },
          headers,
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Błąd odczytu pliku"));
    reader.readAsBinaryString(file);
  });
}

export default function PackageImportModal({ currentUser, allGroups = [], existingPackage = null, onClose, onSuccess }) {
  const isAdmin = currentUser?.role === "admin";
  const isAppendMode = !!existingPackage;
  const [name, setName] = useState(existingPackage?.name || "");
  const [description, setDescription] = useState(existingPackage?.description || "");
  const [selectedGroupId, setSelectedGroupId] = useState(existingPackage?.group_id || currentUser?.groupId || "");
  const [selectedGroupName, setSelectedGroupName] = useState(existingPackage?.group_name || currentUser?.groupName || "");
  const [file, setFile] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [mapping, setMapping] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [parseError, setParseError] = useState("");
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const fileRef = useRef();

  const handleFileChange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setParseError("");
    setContacts([]);
    setMapping(null);
    try {
      const result = await parseExcel(f);
      setContacts(result.contacts);
      setMapping(result.mapping);
      setHeaders(result.headers);
      if (result.contacts.length === 0) {
        setParseError("Nie znaleziono żadnych kontaktów. Sprawdź format pliku.");
      }
    } catch (err) {
      setParseError(err.message || "Błąd odczytu pliku.");
    }
  };

  const handleImport = async () => {
    if ((!isAppendMode && !name.trim()) || contacts.length === 0) return;
    setImporting(true);
    const effectiveGroupId = isAppendMode ? existingPackage.group_id : (isAdmin ? selectedGroupId : (currentUser.groupId || ""));
    const effectiveGroupName = isAppendMode ? existingPackage.group_name : (isAdmin ? selectedGroupName : (currentUser.groupName || ""));

    if (!effectiveGroupId) {
      setParseError(isAdmin ? "Wybierz grupę przed importem." : "Twoje konto nie ma przypisanej grupy. Skontaktuj się z administratorem.");
      setImporting(false);
      return;
    }
    try {
      const res = await base44.functions.invoke("importContactLeads", {
        packageId: existingPackage?.id || null,
        packageMeta: {
          name: name.trim(),
          description: description.trim(),
          group_id: effectiveGroupId,
          group_name: effectiveGroupName,
          created_by_name: currentUser.displayName || currentUser.full_name || "",
        },
        contacts,
      });
      setImportedCount(res.data?.created || contacts.length);
      setDone(true);
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || "spróbuj ponownie.";
      setParseError("Błąd importu: " + msg);
    } finally {
      setImporting(false);
    }
  };

  const colName = (idx) => idx >= 0 && headers[idx] ? headers[idx] : "—";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{isAppendMode ? "Doimportuj kontakty" : "Importuj paczkę kontaktów"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {!done ? (
            <>
              {isAppendMode ? (
                <div className="bg-green-50 border border-green-100 rounded-xl p-3">
                  <p className="text-sm text-green-800">Nowe kontakty zostaną dopisane do paczki:</p>
                  <p className="font-semibold text-green-900">{existingPackage.name}</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1.5">Nazwa paczki *</label>
                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="np. Kontakty kwiecień 2026" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1.5">Opis (opcjonalny)</label>
                    <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="np. Rejon Kraków, kampania wiosenna" />
                  </div>
                </>
              )}

              {isAdmin && !isAppendMode && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">Przypisz do grupy *</label>
                  <select
                    value={selectedGroupId}
                    onChange={e => {
                      const g = allGroups.find(g => g.id === e.target.value);
                      setSelectedGroupId(e.target.value);
                      setSelectedGroupName(g?.name || "");
                    }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-200"
                  >
                    <option value="">— wybierz grupę —</option>
                    {allGroups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                  {allGroups.length === 0 && (
                    <p className="text-xs text-gray-400 mt-1">Ładowanie grup…</p>
                  )}
                </div>
              )}

              {/* Upload */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Plik Excel (.xlsx, .xls, .csv) *</label>
                <div
                  className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-green-300 transition-colors cursor-pointer"
                  onClick={() => fileRef.current?.click()}
                >
                  {file ? (
                    <div className="flex flex-col items-center gap-1.5">
                      <FileSpreadsheet className="w-8 h-8 text-green-600" />
                      <p className="text-sm font-medium text-gray-900">{file.name}</p>
                      {contacts.length > 0 && (
                        <p className="text-xs text-green-700 font-medium">{contacts.length} kontaktów wczytanych</p>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-8 h-8 text-gray-300" />
                      <p className="text-sm text-gray-500">Kliknij aby wybrać plik</p>
                      <p className="text-xs text-gray-400">System automatycznie wykryje kolumny z imieniem, telefonem i adresem</p>
                    </div>
                  )}
                  <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
                </div>
                {parseError && (
                  <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />{parseError}
                  </p>
                )}
              </div>

              {/* Wykryte mapowanie */}
              {mapping && contacts.length > 0 && (
                <div className="bg-green-50 rounded-xl p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-green-800 mb-2">Wykryte kolumny:</p>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <span className="text-gray-500">Imię i nazwisko:</span>
                    <span className="font-medium text-gray-800">{colName(mapping.nameIdx)}</span>
                    <span className="text-gray-500">Telefon:</span>
                    <span className="font-medium text-gray-800">{colName(mapping.phoneIdx)}</span>
                    <span className="text-gray-500">Adres:</span>
                    <span className="font-medium text-gray-800">{colName(mapping.addressIdx)}</span>
                    {mapping.notesIdx >= 0 && (
                      <>
                        <span className="text-gray-500">Notatki:</span>
                        <span className="font-medium text-gray-800">{colName(mapping.notesIdx)}</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Podgląd */}
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
                            <td className="px-3 py-2 text-gray-900">{c.client_name || <span className="text-gray-300">—</span>}</td>
                            <td className="px-3 py-2 text-gray-600">{c.client_phone || <span className="text-gray-300">—</span>}</td>
                            <td className="px-3 py-2 text-gray-600 max-w-[120px] truncate">{c.client_address || <span className="text-gray-300">—</span>}</td>
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

              {importing && (
                <div className="flex items-center justify-center gap-3 py-4">
                  <Loader2 className="w-5 h-5 text-green-600 animate-spin" />
                  <span className="text-sm text-gray-600">Importowanie {contacts.length} kontaktów…</span>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center py-8 gap-4 text-center">
              <CheckCircle className="w-12 h-12 text-green-500" />
              <p className="text-lg font-bold text-gray-900">Import zakończony!</p>
              <p className="text-sm text-gray-500">
                Zaimportowano <strong>{importedCount}</strong> kontaktów do paczki <strong>{name}</strong>.
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          {!done ? (
            <>
              <Button variant="outline" onClick={onClose} disabled={importing}>Anuluj</Button>
              <Button
                onClick={handleImport}
                disabled={(!isAppendMode && !name.trim()) || contacts.length === 0 || importing}
                className="bg-green-600 hover:bg-green-700 text-white gap-2"
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {importing ? "Importowanie…" : `Importuj (${contacts.length})`}
              </Button>
            </>
          ) : (
            <Button onClick={onSuccess} className="bg-green-600 hover:bg-green-700 text-white">Gotowe</Button>
          )}
        </div>
      </div>
    </div>
  );
}