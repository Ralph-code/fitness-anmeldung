// Studierzeiten: mehrere Einheiten pro Tag, Zeiten vom Admin.
// Die Pflicht wird pro Student einzeln gesetzt (users.studyRequired).

import { toMinutes } from "@/lib/schedule";

export type StudySlot = { id: string; start: string; end: string; label: string };
export type StudySchedule = { slots: StudySlot[] };

export const MAX_STUDY_SLOTS = 8;

const slot = (start: string, end: string): StudySlot => ({ id: start.replace(":", ""), start, end, label: `${start}-${end}` });

export const DEFAULT_STUDY: StudySchedule = {
  slots: [slot("15:00", "16:00"), slot("16:15", "17:15"), slot("20:00", "21:00")],
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validateStudySchedule(input: { slots?: unknown }): StudySchedule {
  if (!Array.isArray(input.slots) || input.slots.length === 0) throw new Error("Mindestens eine Studierzeit nötig");
  if (input.slots.length > MAX_STUDY_SLOTS) throw new Error(`Maximal ${MAX_STUDY_SLOTS} Studierzeiten`);

  const ids = new Set<string>();
  const slots = input.slots
    .map((raw) => {
      const s = (raw ?? {}) as Partial<StudySlot>;
      const id = String(s.id ?? "");
      const start = String(s.start ?? "");
      const end = String(s.end ?? "");
      if (!/^[A-Za-z0-9_-]{1,40}$/.test(id) || ids.has(id)) throw new Error("Slot-ID ungültig");
      ids.add(id);
      if (!TIME.test(start) || !TIME.test(end)) throw new Error("Uhrzeit ungültig");
      if (toMinutes(start) >= toMinutes(end)) throw new Error(`${start}-${end}: Ende muss nach dem Start liegen`);
      return { id, start, end, label: `${start}-${end}` };
    })
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));

  for (let i = 1; i < slots.length; i++) {
    if (toMinutes(slots[i].start) < toMinutes(slots[i - 1].end)) {
      throw new Error(`${slots[i - 1].label} und ${slots[i].label} überschneiden sich`);
    }
  }
  return { slots };
}

export function normalizeStudySchedule(data: unknown): StudySchedule {
  try {
    return validateStudySchedule((data ?? {}) as { slots?: unknown });
  } catch {
    return DEFAULT_STUDY;
  }
}

export const studySlotById = (schedule: StudySchedule, id: string | undefined) => schedule.slots.find((s) => s.id === id);

/** Studierzeit ist wählbar, solange sie an diesem Tag noch nicht begonnen hat */
export function canChooseStudy(date: string, slotStart: string, now: { date: string; minutes: number }) {
  if (date < now.date) return false;
  if (date > now.date) return true;
  return toMinutes(slotStart) > now.minutes;
}
