// Raporty po spotkaniach i wydarzenia w kalendarzu starsze niż 30 dni
// są ukrywane handlowcom — widzi je tylko administrator.
export const OLD_RECORD_DAYS = 30;

export function isOlderThanDays(dateValue, days = OLD_RECORD_DAYS, now = Date.now()) {
  if (!dateValue) return false;
  const ts = new Date(dateValue).getTime();
  if (Number.isNaN(ts)) return false;
  return now - ts >= days * 24 * 60 * 60 * 1000;
}