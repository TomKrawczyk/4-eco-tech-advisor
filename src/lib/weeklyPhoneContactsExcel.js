import * as XLSX from "xlsx";

const columns = [
  { key: "struktura", header: "Struktura", width: 28 },
  { key: "klient", header: "Klient", width: 24 },
  { key: "telefon", header: "Telefon", width: 18 },
  { key: "data", header: "Data", width: 14 },
  { key: "doradca", header: "Doradca", width: 20 },
  { key: "doradca_email", header: "E-mail doradcy", width: 28 },
  { key: "adres", header: "Adres", width: 34 },
  { key: "status_raportu", header: "Status raportu", width: 20 },
  { key: "zaraportowano", header: "Zaraportowano", width: 16 },
];

function createSheet(rows) {
  const headerRow = columns.map((column) => column.header);
  const bodyRows = rows.map((row) => columns.map((column) => String(row?.[column.key] ?? "")));
  const worksheet = XLSX.utils.aoa_to_sheet([headerRow, ...bodyRows]);

  worksheet["!cols"] = columns.map((column) => ({ wch: column.width }));
  worksheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(bodyRows.length, 1), c: columns.length - 1 } }),
  };
  worksheet["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" };

  return worksheet;
}

export function downloadWeeklyPhoneContactsExcel(rows, from, to) {
  const workbook = XLSX.utils.book_new();
  const allRows = Array.isArray(rows) ? rows : [];
  const missingRows = allRows.filter((row) => String(row?.zaraportowano || "").toUpperCase() === "NIE");

  XLSX.utils.book_append_sheet(workbook, createSheet(allRows), "Wszystkie telefony");
  XLSX.utils.book_append_sheet(workbook, createSheet(missingRows), "Do obdzwonienia");

  XLSX.writeFile(workbook, `Kontakty_telefoniczne_${from || "zakres"}_${to || "zakres"}.xlsx`, { compression: true });
}