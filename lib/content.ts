// Inhalte, die der Admin pflegt: Neuigkeiten, Essensplan, Vermerke.
// Wird vom Server (Validierung) und vom UI (Kategorien/Labels) benutzt.

export type MealKey = "lunch" | "dinner";

/** Nachtschlüssel gibt es erst ab diesem Alter */
export const NIGHT_KEY_MIN_AGE = 18;

/** Essens-Anwesenheit: "in" = dabei (Standard), "out" = abgemeldet */
export type MealStatus = "in" | "out";
/** Kontrolle durch das Personal */
export type CheckStatus = "present" | "missing";

export const SIGNOFF_REASONS = ["Zuhause", "Schule", "Sport", "Krank", "Anderes"] as const;

export function validateAttendance(input: Record<string, unknown>) {
  const out: {
    lunch?: MealStatus;
    dinner?: MealStatus;
    reason?: string | null;
    lunchChecked?: CheckStatus | null;
    dinnerChecked?: CheckStatus | null;
  } = {};

  for (const meal of ["lunch", "dinner"] as const) {
    if (input[meal] !== undefined) {
      const value = String(input[meal]);
      if (value !== "in" && value !== "out") throw new Error("Status ungültig");
      out[meal] = value;
    }
    const checkKey = `${meal}Checked` as "lunchChecked" | "dinnerChecked";
    if (input[checkKey] !== undefined) {
      const raw = input[checkKey];
      if (raw === null) out[checkKey] = null;
      else {
        const value = String(raw);
        if (value !== "present" && value !== "missing") throw new Error("Kontrolle ungültig");
        out[checkKey] = value;
      }
    }
  }

  if (input.reason !== undefined) {
    const reason = String(input.reason ?? "").trim().slice(0, 120);
    out.reason = reason || null;
  }

  if (Object.keys(out).length === 0) throw new Error("Keine Änderung angegeben");
  return out;
}

export const POST_CATEGORIES = ["news", "info", "wichtig"] as const;
export type PostCategoryValue = (typeof POST_CATEGORIES)[number];

export const POST_LABELS: Record<PostCategoryValue, string> = {
  news: "Neuigkeit",
  info: "Info",
  wichtig: "Wichtig",
};

export const NOTE_TYPES = ["verweis", "lob", "notiz"] as const;
export type NoteTypeValue = (typeof NOTE_TYPES)[number];

export const NOTE_LABELS: Record<NoteTypeValue, string> = {
  verweis: "Verweis",
  lob: "Lob",
  notiz: "Notiz",
};

export const isIsoDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T12:00:00Z`).toISOString().startsWith(value);

const text = (value: unknown, max: number, field: string, required = true) => {
  const s = String(value ?? "").trim();
  if (required && !s) throw new Error(`${field} fehlt`);
  if (s.length > max) throw new Error(`${field}: maximal ${max} Zeichen`);
  return s;
};

export function validatePost(input: Record<string, unknown>) {
  const category = String(input.category ?? "news") as PostCategoryValue;
  if (!POST_CATEGORIES.includes(category)) throw new Error("Kategorie ungültig");

  return {
    title: text(input.title, 120, "Titel"),
    body: text(input.body, 4000, "Text"),
    category,
    pinned: input.pinned === true,
  };
}

export function validateMeal(input: { date?: unknown; lunch?: unknown; dinner?: unknown; note?: unknown }) {
  const date = String(input.date ?? "");
  if (!isIsoDate(date)) throw new Error("Datum ungültig");
  return {
    date,
    lunch: text(input.lunch, 600, "Mittagessen", false),
    dinner: text(input.dinner, 600, "Abendessen", false),
    note: text(input.note, 300, "Notiz", false),
  };
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validateOpening(input: Record<string, unknown>) {
  const day = (value: unknown, field: string) => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 6) throw new Error(`${field} ungültig`);
    return n;
  };
  const time = (value: unknown, field: string) => {
    const s = String(value ?? "");
    if (!TIME_RE.test(s)) throw new Error(`${field} ungültig`);
    return s;
  };
  const openDay = day(input.openDay, "Öffnungstag");
  const closeDay = day(input.closeDay, "Schließtag");
  if (openDay === closeDay) throw new Error("Öffnungs- und Schließtag müssen verschieden sein");
  return { openDay, openTime: time(input.openTime, "Öffnungszeit"), closeDay, closeTime: time(input.closeTime, "Schließzeit") };
}

export function validateCalendarEntry(input: Record<string, unknown>) {
  const date = String(input.date ?? "");
  if (!isIsoDate(date)) throw new Error("Datum ungültig");

  const optionalTime = (value: unknown, field: string) => {
    if (value === undefined || value === null || value === "") return null;
    const s = String(value);
    if (!TIME_RE.test(s)) throw new Error(`${field} ungültig`);
    return s;
  };

  return {
    date,
    closed: input.closed === true,
    schoolFree: input.schoolFree === true,
    openTime: optionalTime(input.openTime, "Öffnungszeit"),
    closeTime: optionalTime(input.closeTime, "Schließzeit"),
    label: text(input.label, 60, "Bezeichnung", false),
    note: text(input.note, 200, "Notiz", false),
  };
}

export const MAX_CALENDAR_RANGE = 92;

/** Alle Tage von `from` bis `to` (einschließlich) */
export function listDays(from: string, to: string) {
  const days: string[] = [];
  const cursor = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  while (cursor <= end && days.length <= MAX_CALENDAR_RANGE) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

/** Zeitraum für Kalender-Ausnahmen: "von" ist Pflicht, "bis" optional */
export function validateCalendarRange(input: Record<string, unknown>) {
  const entry = validateCalendarEntry(input);
  const to = input.dateTo === undefined || input.dateTo === null || input.dateTo === "" ? entry.date : String(input.dateTo);
  if (!isIsoDate(to)) throw new Error("Enddatum ungültig");
  if (to < entry.date) throw new Error("Das Enddatum liegt vor dem Startdatum");

  const days = listDays(entry.date, to);
  if (days.length > MAX_CALENDAR_RANGE) throw new Error(`Maximal ${MAX_CALENDAR_RANGE} Tage auf einmal`);
  return { entry, days, from: entry.date, to };
}

export function validateNote(input: { uid?: unknown; type?: unknown; text?: unknown }) {
  const type = String(input.type ?? "notiz") as NoteTypeValue;
  if (!NOTE_TYPES.includes(type)) throw new Error("Art ungültig");
  const uid = String(input.uid ?? "");
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw new Error("Student fehlt");
  return { uid, type, text: text(input.text, 500, "Text") };
}
