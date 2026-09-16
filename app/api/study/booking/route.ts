import { adminDb } from "@/lib/firebaseAdmin";
import { isIsoDate } from "@/lib/content";
import { canChooseStudy, normalizeStudySchedule, studySlotById } from "@/lib/study";
import { addDays, zonedNow } from "@/lib/schedule";
import { HttpError, getCaller, readJson, withErrors } from "@/lib/serverAuth";

const MAX_DAYS_AHEAD = 7;

// Student wählt seine Studierzeit für einen Tag (eine pro Tag)
export const POST = withErrors(async (req) => {
  const [caller, { date, slotId }] = await Promise.all([
    getCaller(req),
    readJson<{ date?: string; slotId?: string | null }>(req),
  ]);
  if (caller.isAdmin) throw new HttpError(403, "Admins tragen sich hier nicht ein");

  const day = String(date ?? "");
  if (!isIsoDate(day)) throw new HttpError(400, "Datum ungültig");

  const now = zonedNow();
  if (day < now.date) throw new HttpError(400, "Vergangene Tage nicht änderbar");
  if (day > addDays(now.date, MAX_DAYS_AHEAD)) throw new HttpError(400, "Tag liegt zu weit in der Zukunft");

  const ref = adminDb().doc(`studyBookings/${day}_${caller.uid}`);

  // Auswahl zurücknehmen
  if (slotId === null) {
    const existing = (await ref.get()).data();
    const schedule = normalizeStudySchedule((await adminDb().doc("settings/study").get()).data());
    const current = studySlotById(schedule, existing?.slotId);
    if (current && !canChooseStudy(day, current.start, now)) throw new HttpError(409, "Studierzeit hat schon begonnen");
    await ref.delete();
    return Response.json({ ok: true, removed: true });
  }

  const schedule = normalizeStudySchedule((await adminDb().doc("settings/study").get()).data());
  const slot = studySlotById(schedule, String(slotId ?? ""));
  if (!slot) throw new HttpError(400, "Unbekannte Studierzeit");
  if (!canChooseStudy(day, slot.start, now)) throw new HttpError(409, "Studierzeit hat schon begonnen");

  await ref.set(
    {
      uid: caller.uid,
      date: day,
      name: caller.profile.name ?? caller.profile.username,
      room: caller.profile.room ?? "",
      slotId: slot.id,
      slot: slot.label,
      createdAt: new Date().toISOString(),
      updatedBy: "student",
    },
    { merge: true }
  );
  return Response.json({ ok: true });
});
