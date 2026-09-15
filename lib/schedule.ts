// Buchungsregeln – werden im UI angezeigt UND serverseitig in den API-Routen erzwungen.
// Alle Zeiten gelten in der Zeitzone des Heims, egal wo Server oder Handy stehen.
// Slots, Plätze und Buchungsstart legt der Admin fest (Firestore: settings/schedule).

export const TIME_ZONE = "Europe/Rome";
export const LOGIN_EMAIL_DOMAIN = "fitness.local";
export const MAX_SLOTS = 24;
export const MAX_SLOT_CAPACITY = 50;

export type Slot = {
  id: string;
  start: string;
  end: string;
  label: string;
  capacity: number;
  minAge: number | null;
};

export type SlotConfig = Omit<Slot, "label">;

export type Schedule = {
  /** Ab dieser Uhrzeit wird für den nächsten Tag gebucht */
  opensAt: string;
  /** Nach Startzeit sortiert; Buchungsschluss ist der Start des letzten Slots */
  slots: Slot[];
};

export const toSlot = (c: SlotConfig): Slot => ({ ...c, label: `${c.start}-${c.end}` });

const defaultSlot = (start: string, end: string, minAge: number | null = null) =>
  toSlot({ id: start.replace(":", ""), start, end, capacity: 6, minAge });

export const DEFAULT_SCHEDULE: Schedule = {
  opensAt: "21:15",
  slots: [
    defaultSlot("06:00", "07:00"),
    defaultSlot("13:30", "14:30"),
    defaultSlot("14:30", "15:30"),
    defaultSlot("15:30", "16:30"),
    defaultSlot("16:30", "17:30"),
    defaultSlot("17:30", "18:30"),
    defaultSlot("18:30", "19:30"),
    defaultSlot("19:30", "20:30", 16),
    defaultSlot("20:30", "21:30", 16),
  ],
};

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export const fromMinutes = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** Prüft einen Zeitplan (Admin-Formular oder Firestore) und sortiert die Slots. Wirft bei Fehlern. */
export function validateSchedule(input: { opensAt?: unknown; slots?: unknown }): Schedule {
  const opensAt = String(input.opensAt ?? "");
  if (!TIME_PATTERN.test(opensAt)) throw new Error("Buchungsstart ungültig");
  if (!Array.isArray(input.slots) || input.slots.length === 0) throw new Error("Mindestens ein Slot nötig");
  if (input.slots.length > MAX_SLOTS) throw new Error(`Maximal ${MAX_SLOTS} Slots`);

  const ids = new Set<string>();
  const slots = input.slots
    .map((raw) => {
      const s = (raw ?? {}) as Partial<Record<keyof SlotConfig, unknown>>;
      const id = String(s.id ?? "");
      const start = String(s.start ?? "");
      const end = String(s.end ?? "");
      if (!/^[A-Za-z0-9_-]{1,40}$/.test(id) || ids.has(id)) throw new Error("Slot-ID ungültig");
      ids.add(id);
      if (!TIME_PATTERN.test(start) || !TIME_PATTERN.test(end)) throw new Error("Uhrzeit ungültig");
      if (toMinutes(start) >= toMinutes(end)) throw new Error(`${start}-${end}: Ende muss nach dem Start liegen`);
      const capacity = Number(s.capacity);
      if (!Number.isInteger(capacity) || capacity < 1 || capacity > MAX_SLOT_CAPACITY) {
        throw new Error(`${start}-${end}: 1 bis ${MAX_SLOT_CAPACITY} Plätze`);
      }
      const minAge = s.minAge == null ? null : Number(s.minAge);
      if (minAge !== null && (!Number.isInteger(minAge) || minAge < 1 || minAge > 99)) {
        throw new Error(`${start}-${end}: Mindestalter ungültig`);
      }
      return toSlot({ id, start, end, capacity, minAge });
    })
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));

  for (let i = 1; i < slots.length; i++) {
    if (toMinutes(slots[i].start) < toMinutes(slots[i - 1].end)) {
      throw new Error(`${slots[i - 1].label} und ${slots[i].label} überschneiden sich`);
    }
  }

  const lastStart = slots[slots.length - 1].start;
  if (toMinutes(opensAt) <= toMinutes(lastStart)) {
    throw new Error(`Buchungsstart muss nach ${lastStart} liegen (Start letzter Slot)`);
  }
  return { opensAt, slots };
}

/** Liest den gespeicherten Zeitplan; bei fehlenden oder kaputten Daten gilt der Standard */
export function normalizeSchedule(data: unknown): Schedule {
  try {
    return validateSchedule((data ?? {}) as { opensAt?: unknown; slots?: unknown });
  } catch {
    return DEFAULT_SCHEDULE;
  }
}

export const bookingClosesAt = (schedule: Schedule) => schedule.slots[schedule.slots.length - 1].start;

export const slotById = (schedule: Schedule, id: string | undefined) => schedule.slots.find((s) => s.id === id);

// Ältere Buchungen hatten nur das Label ("06:00-07:00") gespeichert
export const slotIdOf = (schedule: Schedule, b: { slotId?: string; slot?: string }) =>
  b.slotId ?? schedule.slots.find((s) => s.label === b.slot)?.id;

/** Aktuelles Datum (YYYY-MM-DD) und Minuten seit Mitternacht in der Heim-Zeitzone */
export function zonedNow(now = new Date()) {
  const parts: Record<string, string> = {};
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(now)
    .forEach((p) => (parts[p.type] = p.value));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type BookingWindow = {
  today: string;
  nowMinutes: number;
  /** today: bis zum letzten Slot für heute · pause: bis zum Buchungsstart · tomorrow: für morgen */
  phase: "today" | "pause" | "tomorrow";
  /** Der Tag, für den gerade gebucht werden kann (in der Pause: der nächste Tag) */
  date: string;
};

export function getBookingWindow(schedule: Schedule, now = new Date()): BookingWindow {
  const { date: today, minutes } = zonedNow(now);
  if (minutes >= toMinutes(schedule.opensAt)) {
    return { today, nowMinutes: minutes, phase: "tomorrow", date: addDays(today, 1) };
  }
  if (minutes >= toMinutes(bookingClosesAt(schedule))) {
    return { today, nowMinutes: minutes, phase: "pause", date: addDays(today, 1) };
  }
  return { today, nowMinutes: minutes, phase: "today", date: today };
}

export function hasSlotStarted(w: BookingWindow, date: string, s: Slot) {
  return date < w.today || (date === w.today && toMinutes(s.start) <= w.nowMinutes);
}

export function canBookSlot(w: BookingWindow, s: Slot) {
  return w.phase !== "pause" && !hasSlotStarted(w, w.date, s);
}

type AgeFields = { birthDate?: string | null; birthYear?: number | null };

export function ageOn(profile: AgeFields, date: string): number | null {
  const [y, m, d] = date.split("-").map(Number);
  if (profile.birthDate) {
    const [by, bm, bd] = profile.birthDate.split("-").map(Number);
    let age = y - by;
    if (m < bm || (m === bm && d < bd)) age--;
    return age;
  }
  if (profile.birthYear) return y - profile.birthYear;
  return null;
}

export function isOldEnough(profile: AgeFields, s: Slot, date: string) {
  if (!s.minAge) return true;
  const age = ageOn(profile, date);
  return age !== null && age >= s.minAge;
}

/** suspendedUntil ist inklusive: gesperrt bis einschließlich diesem Tag */
export function suspendedOn(profile: { suspendedUntil?: string | null }, date: string) {
  return !!profile.suspendedUntil && date <= profile.suspendedUntil;
}

/** "Max Müller" -> "max.mueller" (wird auch beim Login auf die Eingabe angewendet) */
export function toUsername(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

export const usernameToEmail = (username: string) => `${username}@${LOGIN_EMAIL_DOMAIN}`;

export const normalizeRoom = (room: string) => room.replace(/\s+/g, "").toUpperCase();
/** Zimmernummer mit optionalem Buchstaben: "101" oder "101A" */
export const isValidRoom = (room: string) => /^\d{1,4}[A-Z]?$/.test(room);

/** Akzeptiert "TT.MM.JJJJ" oder "JJJJ-MM-TT", liefert "JJJJ-MM-TT" oder null */
export function parseBirthDate(input: string): string | null {
  const value = input.trim();
  let y: number, m: number, d: number;
  const de = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (de) [d, m, y] = [Number(de[1]), Number(de[2]), Number(de[3])];
  else if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  if (y < 1900 || y > new Date().getFullYear()) return null;
  return date.toISOString().slice(0, 10);
}

export function formatDate(date: string, options: Intl.DateTimeFormatOptions) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("de-DE", { timeZone: "UTC", ...options });
}
