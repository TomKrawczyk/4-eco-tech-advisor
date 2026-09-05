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

function getMeetingDate(r) {
  if (r.meeting_date && /^\d{4}-\d{2}-\d{2}$/.test(r.meeting_date)) return r.meeting_date;
  if (r.meeting_calendar) {
    const m = String(r.meeting_calendar).match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  return "";
}

function buildMeetingAssignmentPins(records, currentUserEmail) {
  const pins = [];
  let skippedNoCode = 0;
  const today = new Date().toISOString().split("T")[0];
  for (const r of records) {
    const isAssigned = !!(r.assigned_user_email && r.assigned_user_email.trim());
    const assignedToMe = isAssigned && currentUserEmail && r.assigned_user_email === currentUserEmail;
    // Pokazuj tylko: nieprzypisane LUB przypisane do mnie (do "Dodaj do kalendarza")
    if (isAssigned && !assignedToMe) continue;

    const meetingDate = getMeetingDate(r);
    // Wyklucz błędne daty (rok < 2026) oraz spotkania z przeszłości
    if (meetingDate) {
      const year = parseInt(meetingDate.slice(0, 4), 10);
      if (year < 2026 || meetingDate < today) continue;
    } else {
      // Brak daty spotkania → pomiń
      continue;
    }

    const code = extractPostalCode(r.client_address, r.comments, r.notes);
    if (!code) { skippedNoCode += 1; continue; }

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
      meeting_date: meetingDate,
      sheet: r.sheet || "",
      isAssigned,
    });
  }
  return { pins, skippedNoCode };
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

  const meetingResult = buildMeetingAssignmentPins(meetingAssignments, currentUserEmail);

  const pins = [
    ...buildContactLeadPins(activeLeads),
    ...meetingResult.pins,
    ...buildPhoneContactPins(activePhone),
  ];

  // Pokazuj: nieprzypisane OR przypisane do zalogowanego (do widoku "Moje")
  const filtered = pins.filter(
    (p) => !p.isAssigned || (currentUserEmail && p.assigned_user_email === currentUserEmail)
  );
  return { pins: filtered, skippedNoCode: meetingResult.skippedNoCode };
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

// Spotkanie bliskie (<48h) — pulsująca obwódka
export function isMeetingNear(pin) {
  if (pin.type !== "spotkanie" || !pin.meeting_date) return false;
  const target = new Date(`${pin.meeting_date}T23:59:59`).getTime();
  if (Number.isNaN(target)) return false;
  const diff = target - Date.now();
  return diff >= 0 && diff <= 48 * 60 * 60 * 1000;
}

// Link "Dodaj do kalendarza" (Google Calendar) z danych spotkania
export function buildGoogleCalendarUrl(pin) {
  const date = pin.meeting_date;
  if (!date) return "";
  let time = "09:00";
  const tm = String(pin.meeting_calendar || "").match(/(\d{1,2}):(\d{2})/);
  if (tm) time = `${tm[1].padStart(2, "0")}:${tm[2]}`;
  const [y, mo, d] = date.split("-");
  const [h, mi] = time.split(":");
  const start = `${y}${mo}${d}T${h}${mi}00`;
  const endDt = new Date(`${date}T${time}:00`);
  endDt.setHours(endDt.getHours() + 1);
  const pad = (n) => String(n).padStart(2, "0");
  const end = `${endDt.getFullYear()}${pad(endDt.getMonth() + 1)}${pad(endDt.getDate())}T${pad(endDt.getHours())}${pad(endDt.getMinutes())}00`;
  const text = encodeURIComponent(`Spotkanie — ${pin.client_name || "Klient"}`);
  const details = encodeURIComponent(`Adres: ${pin.client_address || ""}${pin.notes ? `\nUwagi: ${pin.notes}` : ""}`);
  const loc = encodeURIComponent(pin.client_address || "");
  return `https://www.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${start}/${end}&details=${details}&location=${loc}`;
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