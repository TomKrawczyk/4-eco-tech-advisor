import * as XLSX from "xlsx";

// Eksport ukrytych danych do jednego pliku Excel z kilkoma zakładkami.
function addSheet(wb, name, rows) {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Info: "Brak danych" }]);
  XLSX.utils.book_append_sheet(wb, ws, name);
}

const RESULT_LABELS = {
  interested: "Zainteresowany",
  not_interested: "Niezainteresowany",
  no_answer: "Brak odpowiedzi",
  callback: "Ponowny kontakt",
  meeting_scheduled: "Umówione spotkanie",
  other: "Inne",
};

export function exportHiddenRecordsToExcel({ leads = [], phoneContacts = [], meetingReports = [], calendarEvents = [], packageNames = {}, reportByKey = {} }) {
  const wb = XLSX.utils.book_new();

  addSheet(wb, "Kontakty z paczek", leads.map(l => ({
    "Paczka": packageNames[l.package_id] || l.package_id || "",
    "Klient": l.client_name || "",
    "Telefon": l.client_phone || "",
    "Adres": l.client_address || "",
    "Kod pocztowy": l.postal_code || "",
    "Status": l.status || "",
    "Handlowiec": l.assigned_user_name || "",
    "Email handlowca": l.assigned_user_email || "",
    "Data kontaktu": l.contacted_at || "",
    "Notatki handlowca (powód)": l.contact_notes || "",
    "Notatka z importu": l.notes || "",
    "Umówione spotkanie": [l.scheduled_meeting_date, l.scheduled_meeting_time].filter(Boolean).join(" "),
  })));

  addSheet(wb, "Kontakty telefoniczne", phoneContacts.map(c => {
    const report = reportByKey[c.contact_key];
    return {
    "Klient": c.client_name || "",
    "Telefon": c.phone || c.client_phone || "",
    "Adres": c.address || c.client_address || "",
    "Arkusz": c.sheet || "",
    "Data": c.contact_date || c.date || "",
    "Status": c.status || "",
    "Doradca": c.assigned_user_name || "",
    "Email doradcy": c.assigned_user_email || "",
    "Grupa": c.assigned_group_name || "",
    "Uwagi z arkusza": c.comments || "",
    "Wynik raportu": report ? (RESULT_LABELS[report.result] || report.result || "") : "Brak raportu",
    "Opis rozmowy": report?.description || "",
    "Kolejne kroki": report?.next_steps || "",
    "Data ponownego kontaktu": report?.callback_date || "",
    };
  }));

  addSheet(wb, "Raporty po spotkaniach", meetingReports.map(r => ({
    "Klient": r.client_name || "",
    "Telefon": r.client_phone || "",
    "Adres": r.client_address || "",
    "Data spotkania": r.meeting_date || "",
    "Godzina": r.meeting_time || "",
    "Status": r.status || "",
    "Autor": r.author_name || "",
    "Email autora": r.author_email || "",
    "Opis": r.description || "",
    "Kolejne kroki": r.next_steps || "",
  })));

  addSheet(wb, "Kalendarz", calendarEvents.map(e => ({
    "Tytuł": e.title || "",
    "Data": e.event_date || "",
    "Godzina": e.event_time || "",
    "Typ": e.event_type || "",
    "Status": e.status || "",
    "Klient": e.client_name || "",
    "Telefon": e.client_phone || "",
    "Lokalizacja": e.location || "",
    "Właściciel": e.owner_name || "",
    "Email właściciela": e.owner_email || "",
  })));

  XLSX.writeFile(wb, `ukryte-dane-${new Date().toISOString().split("T")[0]}.xlsx`);
}