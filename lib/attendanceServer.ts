import { adminDb } from "@/lib/firebaseAdmin";
import { HttpError } from "@/lib/serverAuth";
import { isIsoDate, validateAttendance, type MealKey } from "@/lib/content";
import { SIGNOFF_DEADLINE, canChangeAttendance } from "@/lib/meals";
import { addDays, zonedNow } from "@/lib/schedule";
import { isAdminProfile, type UserProfile } from "@/lib/types";

const MAX_DAYS_AHEAD = 30;
const ADMIN_PAST_DAYS = 7;

/**
 * Schreibt die Essens-Anwesenheit. Studenten nur bis zur Frist (20:00 am Vortag),
 * das Personal jederzeit – auch rückwirkend für die Kontrolle.
 */
export async function setAttendance({
  uid,
  date,
  changes,
  actor,
  enforceDeadline,
}: {
  uid: string;
  date: string;
  changes: Record<string, unknown>;
  actor: string;
  enforceDeadline: boolean;
}) {
  if (!isIsoDate(date)) throw new HttpError(400, "Datum ungültig");

  const today = zonedNow().date;
  const earliest = enforceDeadline ? today : addDays(today, -ADMIN_PAST_DAYS);
  if (date < earliest) throw new HttpError(400, "Tag liegt zu weit zurück");
  if (date > addDays(today, MAX_DAYS_AHEAD)) throw new HttpError(400, "Tag liegt zu weit in der Zukunft");
  if (enforceDeadline && !canChangeAttendance(date)) {
    throw new HttpError(409, `Abmeldung nur bis ${SIGNOFF_DEADLINE} am Vortag`);
  }

  let data;
  try {
    data = validateAttendance(changes);
  } catch (e) {
    throw new HttpError(400, (e as Error).message);
  }
  if (enforceDeadline && ("lunchChecked" in data || "dinnerChecked" in data)) {
    throw new HttpError(403, "Kontrolle nur durch das Personal");
  }

  const userSnap = await adminDb().doc(`users/${uid}`).get();
  const profile = userSnap.data() as UserProfile | undefined;
  if (!profile) throw new HttpError(404, "Student nicht gefunden");
  if (isAdminProfile(profile)) throw new HttpError(403, "Nur für Studenten");

  // Neue (oder aufgehobene) Fehlmeldung muss vom Studenten neu bestätigt werden
  const ack: Record<string, null> = {};
  if ("lunchChecked" in data) ack.lunchAckAt = null;
  if ("dinnerChecked" in data) ack.dinnerAckAt = null;

  await adminDb().doc(`mealAttendance/${date}_${uid}`).set(
    {
      ...data,
      ...ack,
      uid,
      date,
      name: profile.name ?? profile.username,
      room: profile.room ?? "",
      updatedAt: new Date().toISOString(),
      updatedBy: actor,
    },
    { merge: true }
  );
}

/** Student bestätigt, die Fehlmeldung gelesen zu haben */
export async function acknowledgeMissedMeal(uid: string, date: string, meal: MealKey) {
  if (!isIsoDate(date)) throw new HttpError(400, "Datum ungültig");

  const ref = adminDb().doc(`mealAttendance/${date}_${uid}`);
  const snap = await ref.get();
  const entry = snap.data();
  if (!entry || entry.uid !== uid) throw new HttpError(404, "Eintrag nicht gefunden");
  if (entry[`${meal}Checked`] !== "missing") throw new HttpError(409, "Keine offene Meldung");

  await ref.update({ [`${meal}AckAt`]: new Date().toISOString() });
}
