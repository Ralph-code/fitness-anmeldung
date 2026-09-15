import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { deleteUpcomingBookings } from "@/lib/bookingsServer";
import { HttpError, readJson, requireAdmin, withErrors } from "@/lib/serverAuth";
import { getStudent, issuePassword, validateStudent } from "@/lib/students";
import { zonedNow } from "@/lib/schedule";

type Ctx = { params: Promise<{ uid: string }> };

const isIsoDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T12:00:00Z`).toISOString().startsWith(value);

type PatchBody =
  | { action: "update"; name?: string; room?: string; birthDate?: string }
  | { action: "suspend"; until?: string; reason?: string }
  | { action: "unsuspend" }
  | { action: "resetPassword" };

export const PATCH = withErrors<Ctx>(async (req, { params }) => {
  await requireAdmin(req);
  const { uid } = await params;
  const profile = await getStudent(uid);
  const body = await readJson<PatchBody>(req);
  const userRef = adminDb().doc(`users/${uid}`);

  switch (body.action) {
    case "update": {
      const input = validateStudent({
        name: body.name ?? profile.name,
        room: body.room ?? profile.room,
        birthDate: body.birthDate ?? profile.birthDate ?? "",
      });
      await userRef.update({ ...input });
      await adminAuth().updateUser(uid, { displayName: input.name });
      return Response.json({ ok: true });
    }

    case "suspend": {
      const suspendedUntil = body.until ?? "";
      if (!isIsoDate(suspendedUntil) || suspendedUntil < zonedNow().date) {
        throw new HttpError(400, "Sperrdatum ungültig");
      }
      await userRef.update({ suspendedUntil, suspendReason: body.reason?.trim().slice(0, 200) || null });
      const removed = await deleteUpcomingBookings({ uid, untilDate: suspendedUntil });
      return Response.json({ ok: true, removed });
    }

    case "unsuspend":
      await userRef.update({ suspendedUntil: null, suspendReason: null });
      return Response.json({ ok: true });

    case "resetPassword":
      return Response.json({ password: await issuePassword(uid) });

    default:
      throw new HttpError(400, "Unbekannte Aktion");
  }
});

export const DELETE = withErrors<Ctx>(async (req, { params }) => {
  await requireAdmin(req);
  const { uid } = await params;
  await getStudent(uid);

  await deleteUpcomingBookings({ uid });
  try {
    await adminAuth().deleteUser(uid);
  } catch (e) {
    if ((e as { code?: string }).code !== "auth/user-not-found") throw e;
  }
  const db = adminDb();
  await Promise.all([db.doc(`users/${uid}`).delete(), db.doc(`credentials/${uid}`).delete()]);
  return Response.json({ ok: true });
});
