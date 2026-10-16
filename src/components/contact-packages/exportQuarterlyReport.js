import * as XLSX from "xlsx";
import { isHiddenFromAdvisor } from "./leadExpiry";

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

const fmtDate = (v) => (v ? new Date(v).toLocaleString("pl-PL") : "");
const fmtDay = (v) => (v ? new Date(v).toISOString().split("T")[0] : "");

export default function exportQuarterlyReport({ leads, packages, groups, dateFrom, dateTo }) {
  const pkgName = (id) => packages.find((p) => p.id === id)?.name || "";
  const pkgGroupName = (id) => {
    const p = packages.find((p) => p.id === id);
    if (!p) return "";
    return groups.find((g) => g.id === p.group_id)?.name || "Bez grupy";
  };
  const groupName = (id) => groups.find((g) => g.id === id)?.name || "Bez grupy";

  // Arkusz 1: Szczegóły — wszystkie kontakty z okresu
  const detailRows = leads.map((l) => {
    const expired = isHiddenFromAdvisor(l) ? "TAK" : "";
    return {
      "Grupa (przypisania)": groupName(l.group_id),
      "Paczka": pkgName(l.package_id),
      "Grupa paczki (obecna)": pkgGroupName(l.package_id),
      "Klient": l.client_name || "",
      "Telefon": l.client_phone || "",
      "Adres": l.client_address || "",
      "Kod pocztowy": l.postal_code || "",
      "Status": STATUS_LABELS[l.status] || l.status || "",
      "Przypisany do": l.assigned_user_name || "",
      "Email handlowca": l.assigned_user_email || "",
      "Data przypisania": fmtDate(l.assigned_at),
      "Data podjęcia kontaktu": fmtDate(l.contacted_at),
      "Data importu": fmtDay(l.created_date),
      "Zarchiwizowany": l.is_archived ? "TAK" : "",
      "Wygasły": expired,
      "Notatka handlowca": l.contact_notes || "",
      "Notatka z importu": l.notes || "",
      "Data spotkania": l.scheduled_meeting_date || "",
    };
  });

  // Arkusz 2: Podsumowanie wg grupy
  const byGroup = {};
  leads.forEach((l) => {
    const g = groupName(l.group_id);
    if (!byGroup[g]) byGroup[g] = { group: g, total: 0, assigned: 0, archived: 0, expired: 0, byStatus: {} };
    byGroup[g].total += 1;
    if (l.assigned_user_email) byGroup[g].assigned += 1;
    if (l.is_archived) byGroup[g].archived += 1;
    if (isHiddenFromAdvisor(l)) byGroup[g].expired += 1;
    const st = STATUS_LABELS[l.status] || l.status || "Inny";
    byGroup[g].byStatus[st] = (byGroup[g].byStatus[st] || 0) + 1;
  });

  const statusKeys = Array.from(
    new Set(Object.values(byGroup).flatMap((g) => Object.keys(g.byStatus)))
  ).sort();

  const summaryRows = Object.values(byGroup)
    .sort((a, b) => b.total - a.total)
    .map((g) => ({
      "Grupa": g.group,
      "Łącznie kontaktów": g.total,
      "Przypisane": g.assigned,
      "Zarchiwizowane": g.archived,
      "Wygasłe": g.expired,
      ...statusKeys.reduce((acc, k) => { acc[k] = g.byStatus[k] || 0; return acc; }, {}),
    }));

  const wb = XLSX.utils.book_new();

  const wsSum = XLSX.utils.json_to_sheet(summaryRows);
  wsSum["!cols"] = Object.keys(summaryRows[0] || { Grupa: "" }).map((k) => ({ wch: Math.max(12, k.length + 2) }));
  XLSX.utils.book_append_sheet(wb, wsSum, "Podsumowanie wg grupy");

  const wsDet = XLSX.utils.json_to_sheet(detailRows);
  wsDet["!cols"] = Object.keys(detailRows[0] || {}).map((k) => ({
    wch: Math.min(40, Math.max(k.length + 2, ...detailRows.map((r) => String(r[k] || "").length + 2))),
  }));
  XLSX.utils.book_append_sheet(wb, wsDet, "Szczegóły");

  const period = `${dateFrom || "początek"}_${dateTo || "koniec"}`;
  XLSX.writeFile(wb, `Raport_kwartalny_paczek_${period}.xlsx`);
}