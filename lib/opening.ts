// Öffnungszeiten des Heims: wöchentlicher Rhythmus (Standard: Sonntag 19:00 bis Freitag 14:30)
// plus Ausnahmen pro Tag (geschlossen, andere Zeiten, schulfrei).

export type Opening = { openDay: number; openTime: string; closeDay: number; closeTime: string };

export const DEFAULT_OPENING: Opening = { openDay: 0, openTime: "19:00", closeDay: 5, closeTime: "14:30" };

export const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
export const WEEKDAYS_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

export type CalendarEntry = {
  date: string;
  /** ganzer Tag geschlossen */
  closed?: boolean;
  openTime?: string | null;
  closeTime?: string | null;
  schoolFree?: boolean;
  label?: string;
  note?: string;
  updatedAt?: string;
  updatedBy?: string;
};

export type DayState = "open" | "opens" | "closes" | "closed";

export type DayStatus = {
  date: string;
  weekday: number;
  state: DayState;
  openTime?: string;
  closeTime?: string;
  schoolFree: boolean;
  label?: string;
  note?: string;
  /** true, wenn für diesen Tag ein Admin-Eintrag existiert */
  exception: boolean;
};

export const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

const isTime = (value: unknown) => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export function normalizeOpening(data: unknown): Opening {
  const d = (data ?? {}) as Partial<Opening>;
  const day = (v: unknown, fallback: number) =>
    Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 6 ? (v as number) : fallback;
  return {
    openDay: day(d.openDay, DEFAULT_OPENING.openDay),
    openTime: isTime(d.openTime) ? (d.openTime as string) : DEFAULT_OPENING.openTime,
    closeDay: day(d.closeDay, DEFAULT_OPENING.closeDay),
    closeTime: isTime(d.closeTime) ? (d.closeTime as string) : DEFAULT_OPENING.closeTime,
  };
}

/** Liegt dieser Wochentag zwischen Öffnungs- und Schließtag (ohne die beiden Rand-Tage)? */
function isBetween(weekday: number, opening: Opening) {
  for (let w = (opening.openDay + 1) % 7; w !== opening.closeDay; w = (w + 1) % 7) {
    if (w === weekday) return true;
  }
  return false;
}

export function dayStatus(date: string, opening: Opening, entry?: CalendarEntry | null): DayStatus {
  const weekday = weekdayOf(date);
  const common = {
    date,
    weekday,
    schoolFree: entry?.schoolFree === true,
    label: entry?.label || undefined,
    note: entry?.note || undefined,
    exception: !!entry,
  };

  if (entry?.closed) return { ...common, state: "closed" };

  if (weekday === opening.openDay) {
    return { ...common, state: "opens", openTime: entry?.openTime || opening.openTime };
  }
  if (weekday === opening.closeDay) {
    return { ...common, state: "closes", closeTime: entry?.closeTime || opening.closeTime };
  }
  if (isBetween(weekday, opening)) {
    return { ...common, state: "open", openTime: entry?.openTime || undefined, closeTime: entry?.closeTime || undefined };
  }
  // sonst geschlossener Tag – außer der Admin trägt Zeiten ein
  if (entry?.openTime || entry?.closeTime) {
    return { ...common, state: "open", openTime: entry?.openTime || undefined, closeTime: entry?.closeTime || undefined };
  }
  return { ...common, state: "closed" };
}

export function describeDay(status: DayStatus) {
  if (status.state === "closed") return "Geschlossen";
  if (status.state === "opens") return `Öffnet ${status.openTime}`;
  if (status.state === "closes") return `Bis ${status.closeTime}`;
  if (status.openTime || status.closeTime) return `${status.openTime ?? ""}–${status.closeTime ?? ""}`.replace(/^–|–$/, "");
  return "Offen";
}

export const describeOpening = (o: Opening) =>
  `${WEEKDAYS[o.openDay]} ${o.openTime} bis ${WEEKDAYS[o.closeDay]} ${o.closeTime}`;
