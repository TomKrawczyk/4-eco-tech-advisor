import * as XLSX from "xlsx";

const columns = [
  { key: "typ", header: "Typ", width: 12 },
  { key: "struktura", header: "Struktura", width: 22 },
  { key: "klient", header: "Klient", width: 24 },
  { key: "telefon", header: "Telefon", width: 18 },
  { key: "telefon_last9", header: "Tel (9 cyfr)", width: 14 },
  { key: "data", header: "Data", width: 12 },
  { key: "godzina", header: "Godz.", width: 12 },
  { key: "data_godzina", header: "Data i godzina", width: 22 },
  { key: "doradca", header: "Doradca", width: 20 },
  { key: "doradca_email", header: "E-mail doradcy", width: 28 },
  { key: "adres", header: "Adres", width: 34 },
  { key: "status_raportu", header: "Status raportu", width: 18 },
  { key: "czy_zaraportowano", header: "Zaraportowano", width: 16 },
  { key: "do_obdzwonienia", header: "Do obdzwonienia", width: 16 },
];

function toCellValue(row, key) {
  const value = row?.[key];
  return value === null || value === undefined ? "" : String(value);
}

function createSheet(rows) {
  const headerRow = columns.map((column) => column.header);
  const bodyRows = rows.map((row) => columns.map((column) => toCellValue(row, column.key)));
  const worksheet = XLSX.utils.aoa_to_sheet([headerRow, ...bodyRows]);

  worksheet["!cols"] = columns.map((column) => ({ wch: column.width }));
  worksheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: Math.max(bodyRows.length, 1), c: columns.length - 1 },
    }),
  };
  worksheet["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" };

  return worksheet;
}

export function downloadWeeklyReportExcel(rows, from, to) {
  const workbook = XLSX.utils.book_new();
  const allRows = Array.isArray(rows) ? rows : [];
  const toCallRows = allRows.filter((row) => String(row?.do_obdzwonienia || "").toUpperCase() === "TAK");

  XLSX.utils.book_append_sheet(workbook, createSheet(allRows), "Wszyscy");
  XLSX.utils.book_append_sheet(workbook, createSheet(toCallRows), "Do obdzwonienia");

  const safeFrom = from || "zakres";
  const safeTo = to || "zakres";
  XLSX.writeFile(workbook, `Raport_PH_${safeFrom}_${safeTo}.xlsx`, { compression: true });
}