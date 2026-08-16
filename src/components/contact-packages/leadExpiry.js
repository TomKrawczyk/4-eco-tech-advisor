// Reguły automatycznego ukrywania kontaktów handlowcom po zmianie statusu.
// Niezainteresowany / błędny numer: po 48 godzinach.
// Brak odpowiedzi: po 5 dniach.
const EXPIRY_HOURS = {
  not_interested: 48,
  wrong_number: 48,
  no_answer: 24 * 5,
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