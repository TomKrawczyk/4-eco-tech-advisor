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
    // Filtr "Giełda": tylko wolne, niekontaktowane leads bez paczki
    if (r.is_archived) continue;
    if (r.package_id && String(r.package_id).trim()) continue;
    if (r.assigned_user_email && String(r.assigned_user_email).trim()) continue;
    if (r.contacted_at) continue;
    if ((r.status || "unassigned") !== "unassigned") continue;
    const code = extractPostalCode(r.postal_code, r.client_address, r.notes);
    if (!code) continue;
    const isAssigned = false;
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

function addDaysISO(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

function buildMeetingAssignmentPins(records, currentUserEmail) {
  const pins = [];
  let skippedNoCode = 0;
  const today = new Date().toISOString().split("T")[0];
  for (const r of records) {
    if (r.is_archived) continue;
    // "Nie podejmuj\u0119" \u2014 rekord oddany przez tego usera nie pokazuje mu si\u0119 ju\u017c nigdy
    if (Array.isArray(r.released_by) && currentUserEmail && r.released_by.includes(currentUserEmail)) continue;
    const isAssigned = !!(r.assigned_user_email && r.assigned_user_email.trim());
    const assignedToMe = isAssigned && currentUserEmail && r.assigned_user_email === currentUserEmail;
    // Pokazuj tylko: nieprzypisane LUB przypisane do mnie (do "Dodaj do kalendarza")
    if (isAssigned && !assignedToMe) continue;

    const meetingDate = getMeetingDate(r);
    if (!meetingDate) continue;
    // Okno: dziś + 3 dni do przodu, nic starszego, nic dalszego
    {
      const maxDate = addDaysISO(today, 3);
      if (meetingDate < today || meetingDate > maxDate) continue;
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

function buildPhoneContactPins(records, currentUserEmail) {
  const pins = [];
  for (const r of records) {
    if (r.is_archived) continue;
    // "Nie podejmuj\u0119" \u2014 rekord oddany przez tego usera nie pokazuje mu si\u0119 ju\u017c nigdy
    if (Array.isArray(r.released_by) && currentUserEmail && r.released_by.includes(currentUserEmail)) continue;
    const isAssigned = !!(r.assigned_user_email && String(r.assigned_user_email).trim());
    const assignedToMe = isAssigned && currentUserEmail && r.assigned_user_email === currentUserEmail;
    // Giełda: wolne (status do doradcy/ponowne) LUB przypisane do mnie (do "Moje")
    if (isAssigned && !assignedToMe) continue;
    if (!isAssigned) {
      const st = String(r.status || "").trim();
      if (st !== "Kontakt do doradcy") continue;
    }
    const code = extractPostalCode(r.address, r.client_address, r.comments);
    if (!code) continue;
    const st = String(r.status || "").trim();
    pins.push({
      id: `pc_${r.id}`,
      pinId: r.id,
      type: "kontakt",
      source: "PhoneContact",
      phone_status: st,
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
      assigned_at: r.assigned_at || null,
      isAssigned,
    });
  }
  return pins;
}

// Pobiera piny gotowe do renderu: czyta 3 encje + PostalCodeCache (cache only, ZERO Nominatim).
// Piny bez zcache'owanych współrzędnych są pomijane — dorenderuje je najbliższy polling,
// gdy warmupGieldaCache zgeokoduje ich kod w tle.
export async function fetchGieldaPins(currentUserEmail) {
  const [meetingAssignments, phoneContacts, cacheRows] = await Promise.all([
    fetchAllEntityRecords(base44.entities.MeetingAssignment),
    fetchAllEntityRecords(base44.entities.PhoneContact),
    fetchAllEntityRecords(base44.entities.PostalCodeCache),
  ]);

  // Geo z cache (cache only — brak Nominatim w ścieżce renderowania)
  const geoByCode = {};
  for (const r of cacheRows) {
    const code = String(r.postal_code || "").trim();
    if (!code) continue;
    if (r.not_found === true) continue;
    if (typeof r.lat === "number" && typeof r.lon === "number") {
      geoByCode[code] = { lat: r.lat, lon: r.lon, city: r.city || "" };
    }
  }

  const activePhone = phoneContacts.filter((r) => !r.is_archived);
  const meetingResult = buildMeetingAssignmentPins(meetingAssignments, currentUserEmail);

  // Buildery zwracają: nieprzypisane (do giełdy) + przypisane do mnie (do "Moje")
  const rawPins = [
    ...meetingResult.pins,
    ...buildPhoneContactPins(activePhone, currentUserEmail),
  ];

  // Dołącz współrzędne z cache; pomiń piny bez zcache'owanego kodu
  const pins = [];
  for (const p of rawPins) {
    const g = geoByCode[p.postal_code];
    if (!g) continue;
    p.lat = g.lat;
    p.lon = g.lon;
    pins.push(p);
  }

  return { pins, geoByCode, skippedNoCode: meetingResult.skippedNoCode };
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

// Geokodowanie w małych paczkach — backend throttluje Nominatim (1.1s/kod),
// więc pojedyncze wywołanie ze wszystkimi kodami przekracza timeout i nic nie wraca.
// Paczkowanie pozwala każdemu wywołaniu skończyć się w czasie i aktualizować mapę przyrostowo.
export async function geocodeInBatches(postalCodes, onBatch, batchSize = 6) {
  const unique = Array.from(new Set(postalCodes.filter(Boolean)));
  const allGeo = {};
  const allMissing = [];
  for (let i = 0; i < unique.length; i += batchSize) {
    const chunk = unique.slice(i, i + batchSize);
    try {
      const res = await base44.functions.invoke("geocodePostalCode", { postal_codes: chunk });
      const data = res?.data || res;
      const geo = {};
      const missing = [];
      for (const code of chunk) {
        const g = data?.results?.[code];
        if (g && typeof g.lat === "number" && typeof g.lon === "number") {
          geo[code] = g;
          allGeo[code] = g;
        } else {
          missing.push(code);
          allMissing.push(code);
        }
      }
      if (onBatch) onBatch(geo, missing);
    } catch (_e) {
      // błąd paczki — próbujemy dalej z następną
    }
  }
  return { geo: allGeo, missing: allMissing };
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

// "Nie podejmuj\u0119" \u2014 atomiczne oddanie rekordu na Gie\u0142d\u0119.
// Backend updateMany {id, assigned_user_email: <user>} \u2014 tylko w\u0142a\u015bciciel mo\u017ce odda\u0107.
export async function releasePin(pin, reason) {
  try {
    const res = await base44.functions.invoke("releaseGieldaItem", {
      pin_id: pin.pinId,
      entity_name: pin.source,
      reason: reason || "",
    });
    const data = res?.data || res;
    if (data?.ok) return { ok: true };
    return { ok: false, reason: data?.reason || "Nie uda\u0142o si\u0119 zwolni\u0107." };
  } catch (_e) {
    return { ok: false, reason: "Wyst\u0105pi\u0142 b\u0142\u0105d. Spr\u00f3buj ponownie." };
  }
}

// Atomic claim: warunkowy updateMany {id, assigned_user_email: null} po stronie serwera.
// Dwa równoległe przejęcia → modified_count 1 i 0; tylko zwycięzca dostaje ok=true.
export async function claimPin(pin, currentUser) {
  const extra = {};
  if (pin.source === "ContactLead") {
    extra.assigned_at = new Date().toISOString();
    extra.status = "assigned";
  }
  try {
    const res = await base44.functions.invoke("claimGieldaItem", {
      pin_id: pin.pinId,
      entity_name: pin.source,
      extra_updates: extra,
    });
    const data = res?.data || res;
    if (data?.ok) return { ok: true };
    return { ok: false, reason: data?.reason || "Ktoś już podjął ten rekord." };
  } catch (_e) {
    return { ok: false, reason: "Wystąpił błąd. Spróbuj ponownie." };
  }
}