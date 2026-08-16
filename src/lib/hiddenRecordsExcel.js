import * as XLSX from "xlsx";

// Eksport ukrytych danych do jednego pliku Excel z kilkoma zakładkami.
function addSheet(wb, name, rows) {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Info: "Brak danych" }]);
  XLSX.utils.book_append_sheet(wb, ws, name);
}

export function exportHiddenRecordsToExcel({ leads = [], phoneContacts = [], meetingReports = [], calendarEvents = [], packageNames = {} }) {
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
    "Notatki handlowca": l.contact_notes || "",
  })));

  addSheet(wb, "Kontakty telefoniczne", phoneContacts.map(c => ({
    "Klient": c.client_name || "",
    "Telefon": c.phone || c.client_phone || "",
    "Adres": c.address || c.client_address || "",
    "Arkusz": c.sheet || "",
    "Data": c.contact_date || c.date || "",
    "Status": c.status || "",
    "Doradca": c.assigned_user_name || "",
    "Email doradcy": c.assigned_user_email || "",
    "Grupa": c.assigned_group_name || "",
    "Uwagi": c.comments || "",
  })));

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