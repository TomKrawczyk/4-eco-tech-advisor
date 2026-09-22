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

const PHONE_RESULT_LABELS = {
  interested: "Zainteresowany",
  not_interested: "Niezainteresowany",
  no_answer: "Brak odpowiedzi",
  callback: "Do ponownego kontaktu",
  meeting_scheduled: "Spotkanie umówione",
  contract_signed: "Umowa podpisana",
  other: "Inny",
};

const fmtDate = (v) => (v ? new Date(v).toLocaleString("pl-PL") : "");

const normPhone = (p) => (p || "").replace(/\D/g, "").slice(-9);
const normName = (n) => (n || "").trim().toLowerCase();

// Buduje indeks raportów po telefonie i po nazwie klienta (ten sam obiekt wpisu trafia do obu map,
// więc deduplikacja po referencji zadziała, gdy lead pasuje zarówno po telefonie, jak i nazwie).
function buildReportIndex(phoneReports = [], meetingReports = []) {
  const byPhone = new Map();
  const byName = new Map();
  const addKey = (map, key, entry) => {
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(entry);
  };
  const add = (r, type, dateField, resultVal) => {
    const entry = {
      type,
      date: r[dateField] || r.created_date || "",
      result: resultVal || "",
      description: r.description || "",
      next_steps: r.next_steps || "",
      author: r.author_name || r.author_email || "",
    };
    addKey(byPhone, normPhone(r.client_phone), entry);
    addKey(byName, normName(r.client_name), entry);
  };

  (phoneReports || []).forEach((r) =>
    add(r, "Kontakt tel", "contact_date", PHONE_RESULT_LABELS[r.result] || r.result || "")
  );
  (meetingReports || []).forEach((r) =>
    add(r, "Spotkanie", "meeting_date", r.status || "")
  );

  const sortDesc = (arr) => arr.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  byPhone.forEach(sortDesc);
  byName.forEach(sortDesc);
  return { byPhone, byName };
}

function lookupReports(l, idx) {
  const ph = normPhone(l.client_phone);
  const nm = normName(l.client_name);
  const seen = new Set();
  const merged = [];
  const push = (arr) => arr.forEach((e) => { if (!seen.has(e)) { seen.add(e); merged.push(e); } });
  if (ph) push(idx.byPhone.get(ph) || []);
  if (nm) push(idx.byName.get(nm) || []);
  merged.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  return merged;
}

export default function exportPackageToExcel(pkg, leads, reports = {}) {
  const { phoneReports = [], meetingReports = [] } = reports;
  const reportIndex = buildReportIndex(phoneReports, meetingReports);

  // Zbierz wszystkie klucze extra_data z całej paczki
  const extraKeys = [];
  leads.forEach((l) => {
    if (l.extra_data && typeof l.extra_data === "object") {
      Object.keys(l.extra_data).forEach((k) => {
        if (!extraKeys.includes(k)) extraKeys.push(k);
      });
    }
  });

  const rows = leads.map((l) => {
    const rs = lookupReports(l, reportIndex);
    const last = rs[0];
    const row = {
      "Klient": l.client_name || "",
      "Telefon": l.client_phone || "",
      "Adres": l.client_address || "",
      "Kod pocztowy": l.postal_code || "",
      "Status": STATUS_LABELS[l.status] || l.status || "",
      "Przypisany do": l.assigned_user_name || "",
      "Email handlowca": l.assigned_user_email || "",
      "Data przypisania": fmtDate(l.assigned_at),
      "Data podjęcia kontaktu": fmtDate(l.contacted_at),
      "Notatka handlowca": l.contact_notes || "",
      "Liczba raportów": rs.length,
      "Ostatni raport – data": last ? fmtDate(last.date) : "",
      "Ostatni raport – typ": last ? last.type : "",
      "Ostatni raport – wynik": last ? last.result : "",
      "Ostatni raport – autor": last ? last.author : "",
      "Ostatni raport – opis": last ? last.description : "",
      "Notatka z importu": l.notes || "",
      "Data spotkania": l.scheduled_meeting_date || "",
      "Godzina spotkania": l.scheduled_meeting_time || "",
      "Duplikat": l.is_duplicate ? "TAK" : "",
      "Zarchiwizowany": l.is_archived ? "TAK" : "",
      "Data importu": fmtDate(l.created_date),
    };
    extraKeys.forEach((k) => { row[k] = l.extra_data?.[k] ?? ""; });
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = Object.keys(rows[0] || {}).map((k) => ({
    wch: Math.min(40, Math.max(k.length + 2, ...rows.map((r) => String(r[k] || "").length + 2))),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Kontakty");

  // Drugi arkusz: wszystkie dopasowane raporty (po jednym wpisie na raport)
  const reportRows = [];
  leads.forEach((l) => {
    const rs = lookupReports(l, reportIndex);
    rs.forEach((r) => {
      reportRows.push({
        "Klient": l.client_name || "",
        "Telefon": l.client_phone || "",
        "Przypisany do": l.assigned_user_name || "",
        "Data przypisania": fmtDate(l.assigned_at),
        "Typ raportu": r.type,
        "Data raportu": fmtDate(r.date),
        "Wynik": r.result,
        "Opis": r.description,
        "Kolejne kroki": r.next_steps,
        "Autor": r.author,
      });
    });
  });

  if (reportRows.length > 0) {
    const rws = XLSX.utils.json_to_sheet(reportRows);
    rws["!cols"] = Object.keys(reportRows[0]).map((k) => ({
      wch: Math.min(50, Math.max(k.length + 2, ...reportRows.map((r) => String(r[k] || "").length + 2))),
    }));
    XLSX.utils.book_append_sheet(wb, rws, "Raporty");
  }

  const safeName = (pkg.name || "paczka").replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 50);
  XLSX.writeFile(wb, `Paczka_${safeName}_${new Date().toISOString().split("T")[0]}.xlsx`);
}