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
};

const fmtDate = (v) => (v ? new Date(v).toLocaleString("pl-PL") : "");

export default function exportPackageToExcel(pkg, leads) {
  // Zbierz wszystkie klucze extra_data z całej paczki
  const extraKeys = [];
  leads.forEach(l => {
    if (l.extra_data && typeof l.extra_data === "object") {
      Object.keys(l.extra_data).forEach(k => {
        if (!extraKeys.includes(k)) extraKeys.push(k);
      });
    }
  });

  const rows = leads.map(l => {
    const row = {
      "Klient": l.client_name || "",
      "Telefon": l.client_phone || "",
      "Adres": l.client_address || "",
      "Kod pocztowy": l.postal_code || "",
      "Status": STATUS_LABELS[l.status] || l.status || "",
      "Przypisany do": l.assigned_user_name || "",
      "Email handlowca": l.assigned_user_email || "",
      "Data przypisania": fmtDate(l.assigned_at),
      "Data kontaktu": fmtDate(l.contacted_at),
      "Notatka handlowca": l.contact_notes || "",
      "Notatka z importu": l.notes || "",
      "Data spotkania": l.scheduled_meeting_date || "",
      "Godzina spotkania": l.scheduled_meeting_time || "",
      "Duplikat": l.is_duplicate ? "TAK" : "",
      "Zarchiwizowany": l.is_archived ? "TAK" : "",
      "Data importu": fmtDate(l.created_date),
    };
    extraKeys.forEach(k => {
      row[k] = l.extra_data?.[k] ?? "";
    });
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = Object.keys(rows[0] || {}).map(k => ({
    wch: Math.min(40, Math.max(k.length + 2, ...rows.map(r => String(r[k] || "").length + 2))),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Kontakty");

  const safeName = (pkg.name || "paczka").replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 50);
  XLSX.writeFile(wb, `Paczka_${safeName}_${new Date().toISOString().split("T")[0]}.xlsx`);
}