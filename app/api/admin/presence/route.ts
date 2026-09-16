import { adminDb } from "@/lib/firebaseAdmin";
import { logAdmin } from "@/lib/adminLog";
import { isIsoDate } from "@/lib/content";
import { isPresenceStatus } from "@/lib/presence";
import { addDays, zonedNow } from "@/lib/schedule";
import { HttpError, readJson, requireAdmin, withErrors } from "@/lib/serverAuth";
import { isAdminProfile, type UserProfile } from "@/lib/types";

const PAST_DAYS = 14;
const FUTURE_DAYS = 30;

// Personal setzt den Aufenthaltsort und die Zimmerkontrolle
export const PATCH = withErrors(async (req) => {
  const caller = await requireAdmin(req);
  const { uid, date, status, note, roomCheck } = await readJson<Record<string, unknown>>(req);

  const target = String(uid ?? "");
  const day = String(date ?? "");
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(target)) throw new HttpError(400, "Student fehlt");
  if (!isIsoDate(day)) throw new HttpError(400, "Datum ungültig");

  const today = zonedNow().date;
  if (day < addDays(today, -PAST_DAYS) || day > addDays(today, FUTURE_DAYS)) {
    throw new HttpError(400, "Datum außerhalb des Zeitraums");
  }

  const changes: Record<string, unknown> = {};
  if (status !== undefined) {
    if (!isPresenceStatus(status)) throw new HttpError(400, "Status ungültig");
    changes.status = status;
  }
  if (note !== undefined) changes.note = String(note ?? "").trim().slice(0, 200) || null;
  if (roomCheck !== undefined) {
    if (roomCheck !== null && roomCheck !== "present" && roomCheck !== "missing") throw new HttpError(400, "Kontrolle ungültig");
    changes.roomCheck = roomCheck;
    changes.roomCheckAt = roomCheck ? new Date().toISOString() : null;
  }
  if (Object.keys(changes).length === 0) throw new HttpError(400, "Keine Änderung angegeben");

  const userSnap = await adminDb().doc(`users/${target}`).get();
  const profile = userSnap.data() as UserProfile | undefined;
  if (!profile) throw new HttpError(404, "Student nicht gefunden");
  if (isAdminProfile(profile)) throw new HttpError(403, "Nur für Studenten");

  await adminDb().doc(`presence/${day}_${target}`).set(
    {
      ...changes,
      uid: target,
      date: day,
      name: profile.name ?? profile.username,
      room: profile.room ?? "",
      updatedAt: new Date().toISOString(),
      updatedBy: caller.profile.name ?? caller.profile.username,
    },
    { merge: true }
  );

  await logAdmin(caller, "presence.update", { uid: target, name: profile.name, date: day, ...changes });
  return Response.json({ ok: true });
});
