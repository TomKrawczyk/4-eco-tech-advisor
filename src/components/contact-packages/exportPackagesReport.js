import * as XLSX from "xlsx";

const STATUS_LABELS = {
  unassigned: "Nieprzypisany",
  assigned: "Przypisany",
  contacted: "Skontaktowany",
  interested: "Zainteresowany",
  not_interested: "Niezainteresowany",
  no_answer: "Brak odpowiedzi",
  wrong_number: "Błędny numer",
  callback: "Do ponownego kontaktu",
  meeting_scheduled: "Spotkanie umówione",
  offer_submitted: "Złożona oferta",
  contract_signed: "Umowa podpisana",
  withdrawn: "Odstąpienie",
  no_pv_install: "Brak instalacji PV",
  other_ph_contact: "Kontakt z inną strukturą",
};

const STATUS_ORDER = [
  "assigned", "contacted", "callback", "interested", "meeting_scheduled",
  "offer_submitted", "contract_signed", "not_interested", "no_answer",
  "wrong_number", "withdrawn", "no_pv_install", "other_ph_contact", "unassigned",
];

const fmt = (v) => {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d)) return "";
  return d.toLocaleString("pl-PL", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
};

const minDate = (arr) => arr.filter(Boolean).sort()[0] || "";
const maxDate = (arr) => arr.filter(Boolean).sort().slice(-1)[0] || "";

function autoCols(rows) {
  if (!rows.length) return [];
  return Object.keys(rows[0]).map((k) => ({
    wch: Math.min(45, Math.max(k.length + 2, ...rows.map((r) => String(r[k] ?? "").length + 2))),
  }));
}

export default function exportPackagesReport(packages, leads) {
  const byPackage = new Map();
  leads.forEach((l) => {
    if (!l.package_id) return;
    if (!byPackage.has(l.package_id)) byPackage.set(l.package_id, []);
    byPackage.get(l.package_id).push(l);
  });

  // Arkusz 1 — podsumowanie paczek
  const summaryRows = packages.map((p) => {
    const all = byPackage.get(p.id) || [];
    const live = all.filter((l) => !l.is_duplicate && !l.is_archived);
    const row = {
      "Paczka": p.name || "",
      "Grupa": p.group_name || "",
      "Prywatna": p.is_private ? "TAK" : "",
      "Status paczki": p.status === "archived" ? "Archiwum" : "Aktywna",
      "Kontakty": live.length,
      "Przypisane": live.filter((l) => l.assigned_user_email).length,
    };
    STATUS_ORDER.forEach((s) => {
      row[STATUS_LABELS[s]] = live.filter((l) => (l.status || "unassigned") === s).length;
    });
    row["Zarchiwizowane"] = all.filter((l) => l.is_archived === true).length;
    row["Duplikaty"] = all.filter((l) => l.is_duplicate === true).length;
    row["Utworzono paczkę"] = fmt(p.created_date);
    row["Pierwsze przypisanie"] = minDate(all.map((l) => l.assigned_at));
    row["Ostatnie przypisanie"] = maxDate(all.map((l) => l.assigned_at));
    row["Ostatnia zmiana kontaktu"] = maxDate(all.map((l) => l.updated_date));
    return row;
  });

  // Arkusz 2 — szczegóły kontaktów z datami
  const packageName = (id) => packages.find((p) => p.id === id)?.name || "";
  const packageGroup = (id) => packages.find((p) => p.id === id)?.group_name || "";

  const contactRows = [...leads]
    .sort((a, b) =>
      (packageName(a.package_id) || "").localeCompare(packageName(b.package_id) || "", "pl") ||
      (a.client_name || "").localeCompare(b.client_name || "", "pl"))
    .map((l) => ({
      "Paczka": packageName(l.package_id),
      "Grupa": packageGroup(l.package_id),
      "Klient": l.client_name || "",
      "Telefon": l.client_phone || "",
      "Adres": l.client_address || "",
      "Kod pocztowy": l.postal_code || "",
      "Status": STATUS_LABELS[l.status] || l.status || "",
      "Handlowiec": l.assigned_user_name || "",
      "Email handlowca": l.assigned_user_email || "",
      "Data importu": fmt(l.created_date),
      "Data przypisania": fmt(l.assigned_at),
      "Data podjęcia kontaktu": fmt(l.contacted_at),
      "Data zmiany statusu (ostatnia)": fmt(l.updated_date),
      "Data archiwizacji": fmt(l.archived_at),
      "Archiwizowany": l.is_archived ? "TAK" : "",
      "Duplikat": l.is_duplicate ? "TAK" : "",
      "Notatka handlowca": l.contact_notes || "",
      "Notatka z importu": l.notes || "",
    }));

  const wb = XLSX.utils.book_new();

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows.length ? summaryRows : [{ "Paczka": "" }]);
  wsSummary["!cols"] = autoCols(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Paczki");

  const wsContacts = XLSX.utils.json_to_sheet(contactRows.length ? contactRows : [{ "Paczka": "" }]);
  wsContacts["!cols"] = autoCols(contactRows);
  XLSX.utils.book_append_sheet(wb, wsContacts, "Kontakty");

  XLSX.writeFile(wb, `Raport_paczek_${new Date().toISOString().split("T")[0]}.xlsx`);
}