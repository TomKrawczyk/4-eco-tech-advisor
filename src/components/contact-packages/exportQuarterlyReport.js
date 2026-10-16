import * as XLSX from "xlsx";
const STATUS_LABELS = {
  unassigned: "Nieprzypisany", assigned: "Przypisany", contacted: "Skontaktowany",
  interested: "Zainteresowany", not_interested: "Niezainteresowany", no_answer: "Brak odpowiedzi",
  wrong_number: "Błędny numer", callback: "Do ponownego kontaktu", meeting_scheduled: "Spotkanie umówione",
  offer_submitted: "Złożona oferta", contract_signed: "Umowa podpisana", withdrawn: "Odstąpienie",
  no_pv_install: "Brak instalacji PV", other_ph_contact: "Kontakt z inną strukturą",
};

const fmtDate = (v) => (v ? new Date(v).toLocaleString("pl-PL") : "");

function sheetName(name) {
  return (name || "Bez grupy").replace(/[\\/?*[\]:]/g, " ").slice(0, 31);
}

export default function exportQuarterlyReport({ leads, packages, groups, dateFrom, dateTo }) {
  const groupName = (id) => groups.find((g) => g.id === id)?.name || "Bez grupy";
  const pkgName = (id) => packages.find((p) => p.id === id)?.name || "";

  // Pogrupuj kontakty wg grupy przypisania
  const byGroup = {};
  leads.forEach((l) => {
    const g = groupName(l.group_id);
    if (!byGroup[g]) byGroup[g] = [];
    byGroup[g].push(l);
  });

  const wb = XLSX.utils.book_new();

  // Arkusz podsumowania: po jednej linii na grupę
  const summaryRows = Object.entries(byGroup)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([group, list]) => {
      const assigned = list.filter((l) => l.assigned_user_email).length;
      return {
        "Grupa": group,
        "Liczba kontaktów przekazanych": assigned,
        "Łącznie w paczkach": list.length,
      };
    });
  const wsSum = XLSX.utils.json_to_sheet(summaryRows);
  wsSum["!cols"] = [{ wch: 28 }, { wch: 28 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsSum, "Podsumowanie");

  // Po jednej zakładce na grupę z numerami telefonów
  Object.entries(byGroup)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([group, list]) => {
      const rows = list.map((l, i) => ({
        "Lp.": i + 1,
        "Klient": l.client_name || "",
        "Telefon": l.client_phone || "",
        "Status": STATUS_LABELS[l.status] || l.status || "",
        "Przypisany do": l.assigned_user_name || "",
        "Data przypisania": fmtDate(l.assigned_at),
        "Paczka": pkgName(l.package_id),
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [{ wch: 5 }, { wch: 28 }, { wch: 16 }, { wch: 20 }, { wch: 22 }, { wch: 20 }, { wch: 24 }];
      XLSX.utils.book_append_sheet(wb, ws, sheetName(group));
    });

  const period = `${dateFrom || "początek"}_${dateTo || "koniec"}`;
  XLSX.writeFile(wb, `Raport_kwartalny_paczek_${period}.xlsx`);
}