// Wykrywanie klientów już "zamkniętych" (umowa podpisana / sprzedane)
// na podstawie treści raportów i notatek — takie kontakty nie są zaległe.

const CLOSED_KEYWORDS = [
  "sprzedane", "sprzedano", "sprzedaz", "sprzedaż",
  "umowa podpisana", "podpisana umowa", "podpisano umowe", "podpisano umowę",
  "umowa zawarta", "kontrakt podpisany", "zamowienie zlozone", "zamówienie złożone",
];

const norm = (v) => String(v || "").toLowerCase().replace(/[ąćęłńóśźż]/g, (c) =>
  ({ ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z" }[c] || c)
);

export function looksClosed(...texts) {
  const joined = norm(texts.filter(Boolean).join(" "));
  return CLOSED_KEYWORDS.some(k => joined.includes(norm(k)));
}

export const nameKey = (name) => norm(name).replace(/\s+/g, " ").trim();
export const phoneKey = (phone) => String(phone || "").replace(/\D/g, "").slice(-9);

// Zbiera klucze (nazwa + telefon) klientów z raportów, w których widać zamknięcie sprzedaży
export function buildClosedClientKeys(reportSets) {
  const keys = new Set();
  reportSets.forEach(reports => {
    (reports || []).forEach(r => {
      if (looksClosed(r.description, r.next_steps, r.result, r.status, r.comments)) {
        if (r.client_name) keys.add(`n:${nameKey(r.client_name)}`);
        const p = phoneKey(r.client_phone || r.phone);
        if (p) keys.add(`p:${p}`);
      }
    });
  });
  return keys;
}

export function isClientClosed(closedKeys, lead) {
  if (looksClosed(lead.contact_notes, lead.notes)) return true;
  if (lead.client_name && closedKeys.has(`n:${nameKey(lead.client_name)}`)) return true;
  const p = phoneKey(lead.client_phone || lead.phone);
  if (p && closedKeys.has(`p:${p}`)) return true;
  return false;
}