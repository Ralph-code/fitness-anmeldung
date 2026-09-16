import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { deleteUpcomingBookings } from "@/lib/bookingsServer";
import { logAdmin } from "@/lib/adminLog";
import { loadSchedule } from "@/lib/scheduleServer";
import { HttpError, readJson, requireAdmin, withErrors } from "@/lib/serverAuth";
import { deleteStudents, getStudent, issuePassword, validateStudent } from "@/lib/students";
import { zonedNow } from "@/lib/schedule";

type Ctx = { params: Promise<{ uid: string }> };

const isIsoDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T12:00:00Z`).toISOString().startsWith(value);

type PatchBody =
  | {
      action: "update";
      name?: string;
      room?: string;
      birthDate?: string;
      school?: string;
      schoolClass?: string;
      smoker?: boolean;
      dietary?: string;
      nightKey?: boolean;
      studyRequired?: boolean;
    }
  | { action: "suspend"; until?: string; reason?: string }
  | { action: "unsuspend" }
  | { action: "setApproval"; approved?: boolean }
  | { action: "resetPassword" };

export const PATCH = withErrors<Ctx>(async (req, { params }) => {
  const caller = await requireAdmin(req);
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
        school: body.school ?? profile.school ?? "",
        schoolClass: body.schoolClass ?? profile.schoolClass ?? "",
        smoker: body.smoker ?? profile.smoker ?? false,
        dietary: body.dietary ?? profile.dietary ?? "",
        nightKey: body.nightKey ?? profile.nightKey ?? false,
        studyRequired: body.studyRequired ?? profile.studyRequired ?? true,
      });
      await userRef.update({ ...input });
      await adminAuth().updateUser(uid, { displayName: input.name });
      await logAdmin(caller, "student.update", { uid, name: input.name, room: input.room });
      return Response.json({ ok: true });
    }

    case "suspend": {
      const suspendedUntil = body.until ?? "";
      if (!isIsoDate(suspendedUntil) || suspendedUntil < zonedNow().date) {
        throw new HttpError(400, "Sperrdatum ungültig");
      }
      await userRef.update({ suspendedUntil, suspendReason: body.reason?.trim().slice(0, 200) || null });
      const removed = await deleteUpcomingBookings({ uid, untilDate: suspendedUntil });
      await logAdmin(caller, "student.suspend", { uid, name: profile.name, until: suspendedUntil, reason: body.reason ?? null, cancelledBookings: removed });
      return Response.json({ ok: true, removed });
    }

    case "unsuspend":
      await userRef.update({ suspendedUntil: null, suspendReason: null });
      await logAdmin(caller, "student.unsuspend", { uid, name: profile.name });
      return Response.json({ ok: true });

    case "setApproval": {
      const approved = body.approved === true;
      await userRef.update({ approved });
      let removed = 0;
      if (!approved) {
        // Ohne Bestätigung keine Buchungen mehr in "Mit Bestätigung"-Slots
        const schedule = await loadSchedule();
        const slotIds = schedule.slots.filter((s) => s.requiresApproval).map((s) => s.id);
        if (slotIds.length) removed = await deleteUpcomingBookings({ uid, slotIds }, schedule);
      }
      await logAdmin(caller, "student.approval", { uid, name: profile.name, approved, cancelledBookings: removed });
      return Response.json({ ok: true, removed });
    }

    case "resetPassword": {
      const password = await issuePassword(uid);
      await logAdmin(caller, "student.password", { uid, name: profile.name });
      return Response.json({ password });
    }

    default:
      throw new HttpError(400, "Unbekannte Aktion");
  }
});

export const DELETE = withErrors<Ctx>(async (req, { params }) => {
  const caller = await requireAdmin(req);
  const { uid } = await params;
  const profile = await getStudent(uid);

  const { failed } = await deleteStudents([uid]);
  if (failed) throw new HttpError(500, "Löschen fehlgeschlagen");
  await logAdmin(caller, "student.delete", { uid, name: profile.name });
  return Response.json({ ok: true });
});
