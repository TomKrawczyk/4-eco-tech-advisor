import { isValid, startOfDay } from "date-fns";

export function parseMeetingDate(str) {
  if (!str) return null;
  const match = String(str).match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (match) {
    const [, d, m, y] = match;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    if (isValid(date)) return date;
  }
  const parsed = new Date(str);
  if (isValid(parsed)) return parsed;
  return null;
}

export function extractTime(str) {
  if (!str) return "";
  const match = String(str).match(/(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : "";
}

export function findSheetMapping(sheetMappings, sheetName) {
  return sheetMappings.find((sm) => {
    const mappedName = sm.sheet_name || sm.data?.sheet_name || "";
    return (
      mappedName === sheetName ||
      sheetName.startsWith(`${mappedName} `) ||
      sheetName.startsWith(`${mappedName}-`)
    );
  });
}

export function sheetGroupIdOf(sheetMappings, sheetName) {
  const sm = findSheetMapping(sheetMappings, sheetName);
  return sm?.group_id || sm?.data?.group_id || null;
}

export function isUpcoming(date) {
  if (!date) return false;
  return startOfDay(date) >= startOfDay(new Date());
}