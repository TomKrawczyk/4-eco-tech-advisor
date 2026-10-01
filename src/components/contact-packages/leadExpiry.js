// Reguły automatycznego ukrywania kontaktów po zmianie statusu.
// Niezainteresowany / brak odpowiedzi: po 3 dniach (72h).
// Błędny numer: po 48 godzinach.
const EXPIRY_HOURS = {
  not_interested: 24 * 3,
  wrong_number: 48,
  no_answer: 24 * 3,
};

export function getLeadStatusDate(lead) {
  return lead?.contacted_at || lead?.updated_date || lead?.created_date || null;
}

export function isHiddenFromAdvisor(lead, now = Date.now()) {
  const hours = EXPIRY_HOURS[lead?.status];
  if (!hours) return false;
  const date = getLeadStatusDate(lead);
  if (!date) return false;
  const ts = new Date(date).getTime();
  if (Number.isNaN(ts)) return false;
  return now - ts >= hours * 60 * 60 * 1000;
}

export function splitLeadsByVisibility(leads = [], now = Date.now()) {
  const visible = [];
  const hidden = [];
  leads.forEach((lead) => {
    (isHiddenFromAdvisor(lead, now) ? hidden : visible).push(lead);
  });
  return { visible, hidden };
}