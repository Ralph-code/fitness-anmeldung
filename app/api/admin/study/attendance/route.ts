import { adminDb } from "@/lib/firebaseAdmin";
import { logAdmin } from "@/lib/adminLog";
import { isIsoDate } from "@/lib/content";
import { normalizeStudySchedule, studySlotById } from "@/lib/study";
import { addDays, zonedNow } from "@/lib/schedule";
import { HttpError, readJson, requireAdmin, withErrors } from "@/lib/serverAuth";
import { isAdminProfile, type UserProfile } from "@/lib/types";

// Personal trägt Studierzeiten ein und hakt die Anwesenheit ab
export const PATCH = withErrors(async (req) => {
  const caller = await requireAdmin(req);
  const { uid, date, slotId, checked } = await readJson<Record<string, unknown>>(req);

  const target = String(uid ?? "");
  const day = String(date ?? "");
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(target)) throw new HttpError(400, "Student fehlt");
  if (!isIsoDate(day)) throw new HttpError(400, "Datum ungültig");

  const today = zonedNow().date;
  if (day < addDays(today, -14) || day > addDays(today, 30)) throw new HttpError(400, "Datum außerhalb des Zeitraums");

  const ref = adminDb().doc(`studyBookings/${day}_${target}`);

  // Eintrag entfernen
  if (slotId === null) {
    await ref.delete();
    await logAdmin(caller, "study.attendance", { uid: target, date: day, removed: true });
    return Response.json({ ok: true, removed: true });
  }

  const userSnap = await adminDb().doc(`users/${target}`).get();
  const profile = userSnap.data() as UserProfile | undefined;
  if (!profile) throw new HttpError(404, "Student nicht gefunden");
  if (isAdminProfile(profile)) throw new HttpError(403, "Nur für Studenten");

  const changes: Record<string, unknown> = {};
  if (slotId !== undefined) {
    const schedule = normalizeStudySchedule((await adminDb().doc("settings/study").get()).data());
    const slot = studySlotById(schedule, String(slotId));
    if (!slot) throw new HttpError(400, "Unbekannte Studierzeit");
    changes.slotId = slot.id;
    changes.slot = slot.label;
  }
  if (checked !== undefined) {
    if (checked !== null && checked !== "present" && checked !== "missing") throw new HttpError(400, "Kontrolle ungültig");
    changes.checked = checked;
  }
  if (Object.keys(changes).length === 0) throw new HttpError(400, "Keine Änderung angegeben");

  await ref.set(
    {
      ...changes,
      uid: target,
      date: day,
      name: profile.name ?? profile.username,
      room: profile.room ?? "",
      updatedBy: caller.profile.name ?? caller.profile.username,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  await logAdmin(caller, "study.attendance", { uid: target, name: profile.name, date: day, ...changes });
  return Response.json({ ok: true });
});
