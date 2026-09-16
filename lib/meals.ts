import type { MealKey, MealStatus } from "@/lib/content";
import { addDays, toMinutes, zonedNow } from "@/lib/schedule";
import type { MealAttendance } from "@/lib/types";

export const MEAL_TIMES: Record<MealKey, { label: string; short: string; start: string; end: string }> = {
  lunch: { label: "Mittagessen", short: "Mittag", start: "12:30", end: "14:00" },
  dinner: { label: "Abendessen", short: "Abend", start: "18:15", end: "19:00" },
};

export const MEAL_KEYS: MealKey[] = ["lunch", "dinner"];

/** Abmelden geht bis zu dieser Uhrzeit am Vortag */
export const SIGNOFF_DEADLINE = "20:00";

/** Nächste Mahlzeit des Tages (oder null, wenn beide vorbei sind) */
export function nextMeal(nowMinutes: number): MealKey | null {
  for (const key of MEAL_KEYS) {
    if (nowMinutes < toMinutes(MEAL_TIMES[key].end)) return key;
  }
  return null;
}

/** Der Tag, an dem die Abmeldefrist für `date` abläuft (= Vortag, 20:00) */
export const signoffDeadlineDate = (date: string) => addDays(date, -1);

/** Dürfen sich Studenten für diesen Tag noch selbst ab-/anmelden? */
export function canChangeAttendance(date: string, now = zonedNow()) {
  const deadline = signoffDeadlineDate(date);
  return now.date < deadline || (now.date === deadline && now.minutes < toMinutes(SIGNOFF_DEADLINE));
}

/** Ohne Eintrag gilt: dabei */
export const attendanceOf = (entry: MealAttendance | null | undefined, meal: MealKey): MealStatus =>
  entry?.[meal] === "out" ? "out" : "in";
