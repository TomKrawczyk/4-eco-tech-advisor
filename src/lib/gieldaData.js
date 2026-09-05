import { base44 } from "@/api/base44Client";
import { fetchAllEntityRecords } from "@/lib/fetchAllEntityRecords";

const POSTAL_RE = /\d{2}-\d{3}/;

// Wyciąga kod pocztowy z dowolnego pola tekstowego rekordu
export function extractPostalCode(...fields) {
  for (const field of fields) {
    if (!field) continue;
    const text = String(field);
    const match = text.match(POSTAL_RE);
    if (match) return match[0];
  }
  return "";
}

// Wyciąga miasto z adresu (tekst po kodzie pocztowym) lub fallback
export function extractCity(address, geoCity) {
  if (geoCity) return geoCity;
  if (!address) return "";
  const text = String(address);
  const idx = text.search(POSTAL_RE);
  if (idx >= 0) {
    const after = text.slice(idx).replace(POSTAL_RE, "").trim();
    return after.split(/[,;|]/)[0].trim() || "";
  }
  return text.split(/[,;|]/)[0].trim();
}

// Maskowanie imienia: "Jan Kowalski" → "Jan K."
export function maskName(name) {
  const n = String(name || "").trim();
  if (!n) return "Klient";
  const parts = n.split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0) + ".";
  return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
}

// Maskowanie telefonu: "+48 5•• ••• 678"
export function maskPhone(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 0) return "";
  let prefix = "";
  if (digits.startsWith("48")) {
    prefix = "+48 ";
    digits = digits.slice(2);
  }
  if (digits.length < 4) return prefix + "•".repeat(digits.length);
  const first = digits[0];
  const last3 = digits.slice(-3);
  const middle = "•".repeat(Math.min(digits.length - 4, 6));
  return `${prefix}${first}${middle} ${last3}`;
}

// Pełny telefon do wyświetlenia po claim
export function formatPhone(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("48") && digits.length === 11) {
    return `+48 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  if (digits.length === 9) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return phone;
}

function buildContactLeadPins(records) {
  const pins = [];
  for (const r of records) {
    const code = extractPostalCode(r.postal_code, r.client_address, r.notes);
    if (!code) continue;
    const isAssigned = !!(r.assigned_user_email && r.assigned_user_email.trim());
    pins.push({
      id: `cl_${r.id}`,
      pinId: r.id,
      type: "kontakt",
      source: "ContactLead",
      client_name: r.client_name || "",
      client_phone: r.client_phone || "",
      client_address: r.client_address || "",
      postal_code: code,
      notes: r.notes || "",
      extra_data: r.extra_data || {},
      created_date: r.created_date,
      updated_date: r.updated_date,
      assigned_user_email: r.assigned_user_email || "",
      assigned_user_name: r.assigned_user_name || "",
      assigned_at: r.assigned_at || null,
      status: r.status || "unassigned",
      isAssigned,
    });
  }
  return pins;
}

function buildMeetingAssignmentPins(records) {
  const pins = [];
  for (const r of records) {
    const code = extractPostalCode(r.client_address, r.comments, r.notes);
    if (!code) continue;
    const isAssigned = !!(r.assigned_user_email && r.assigned_user_email.trim());
    pins.push({
      id: `ma_${r.id}`,
      pinId: r.id,
      type: "spotkanie",
      source: "MeetingAssignment",
      client_name: r.client_name || "",
      client_phone: r.client_phone || "",
      client_address: r.client_address || "",
      postal_code: code,
      notes: r.comments || "",
      extra_data: {},
      created_date: r.created_date,
      updated_date: r.updated_date,
      assigned_user_email: r.assigned_user_email || "",
      assigned_user_name: r.assigned_user_name || "",
      assigned_at: null,
      meeting_calendar: r.meeting_calendar || "",
      sheet: r.sheet || "",
      isAssigned,
    });
  }
  return pins;
}

function buildPhoneContactPins(records) {
  const pins = [];
  for (const r of records) {
    const code = extractPostalCode(r.address, r.client_address, r.comments);
    if (!code) continue;
    const isAssigned = !!(r.assigned_user_email && r.assigned_user_email.trim());
    pins.push({
      id: `pc_${r.id}`,
      pinId: r.id,
      type: "kontakt",
      source: "PhoneContact",
      client_name: r.client_name || "",
      client_phone: r.phone || r.client_phone || "",
      client_address: r.address || r.client_address || "",
      postal_code: code,
      notes: r.comments || "",
      extra_data: r.interview_data || {},
      created_date: r.created_date,
      updated_date: r.updated_date,
      assigned_user_email: r.assigned_user_email || "",
      assigned_user_name: r.assigned_user_name || "",
      assigned_at: null,
      isAssigned,
    });
  }
  return pins;
}

// Pobiera wszystkie piny z 3 encji (tylko niearchiwizowane, nieprzypisane lub przypisane do mnie)
export async function fetchGieldaPins(currentUserEmail) {
  const [contactLeads, meetingAssignments, phoneContacts] = await Promise.all([
    fetchAllEntityRecords(base44.entities.ContactLead),
    fetchAllEntityRecords(base44.entities.MeetingAssignment),
    fetchAllEntityRecords(base44.entities.PhoneContact),
  ]);

  // Filtr archiwizacji
  const activeLeads = contactLeads.filter((r) => !r.is_archived && !r.is_duplicate);
  const activePhone = phoneContacts.filter((r) => !r.is_archived);

  const pins = [
    ...buildContactLeadPins(activeLeads),
    ...buildMeetingAssignmentPins(meetingAssignments),
    ...buildPhoneContactPins(activePhone),
  ];

  // Pokazuj: nieprzypisane OR przypisane do zalogowanego (do widoku "Moje")
  return pins.filter(
    (p) => !p.isAssigned || (currentUserEmail && p.assigned_user_email === currentUserEmail)
  );
}

// Geokodowanie zbiorcze przez backend function; zwraca mapę code -> {lat,lon,city}
export async function geocodePostalCodes(postalCodes) {
  const unique = Array.from(new Set(postalCodes.filter(Boolean)));
  if (unique.length === 0) return { geo: {}, missing: [] };
  try {
    const res = await base44.functions.invoke("geocodePostalCode", { postal_codes: unique });
    const data = res?.data || res;
    const geo = {};
    const missing = [];
    for (const code of unique) {
      const g = data?.results?.[code];
      if (g && typeof g.lat === "number" && typeof g.lon === "number") {
        geo[code] = g;
      } else {
        missing.push(code);
      }
    }
    return { geo, missing };
  } catch (_e) {
    return { geo: {}, missing: unique };
  }
}

// Wiek pina w ms
export function pinAgeMs(pin) {
  const base = pin.assigned_at || pin.updated_date || pin.created_date;
  if (!base) return Infinity;
  const t = new Date(base).getTime();
  if (Number.isNaN(t)) return Infinity;
  return Date.now() - t;
}

export function isSlaBreached(pin) {
  return !pin.isAssigned && pinAgeMs(pin) > 24 * 60 * 60 * 1000;
}

export function isFresh(pin) {
  return pinAgeMs(pin) < 5 * 60 * 1000;
}

export function isClaimedToday(pin) {
  if (!pin.isAssigned) return false;
  const base = pin.assigned_at || pin.updated_date || pin.created_date;
  if (!base) return false;
  const d = new Date(base);
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

// Atomic claim: sprawdza czy nadal nieprzypisany, potem aktualizuje
export async function claimPin(pin, currentUser) {
  const entityName = pin.source;
  const entity = base44.entities[entityName];

  // Pobierz świeży rekord i potwierdź brak przypisania
  const fresh = await entity.get(pin.pinId);
  const stillFree = !(fresh.assigned_user_email && String(fresh.assigned_user_email).trim());

  if (!stillFree) {
    return { ok: false, reason: "Ktoś już podjął ten rekord." };
  }

  const updates = {
    assigned_user_email: currentUser.email,
    assigned_user_name: currentUser.displayName || currentUser.full_name || "",
  };

  if (pin.source === "ContactLead") {
    updates.assigned_at = new Date().toISOString();
    updates.status = "assigned";
  }

  await entity.update(pin.pinId, updates);
  return { ok: true };
}