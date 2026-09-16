import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { logAdmin } from "@/lib/adminLog";
import { validateStudySchedule } from "@/lib/study";
import { HttpError, readJson, requireAdmin, withErrors } from "@/lib/serverAuth";

// Zeiten der Studierzeiten festlegen
export const PUT = withErrors(async (req) => {
  const caller = await requireAdmin(req);
  const body = await readJson<{ slots?: unknown }>(req);

  let schedule;
  try {
    schedule = validateStudySchedule(body);
  } catch (e) {
    throw new HttpError(400, (e as Error).message);
  }

  await adminDb().doc("settings/study").set({
    slots: schedule.slots.map(({ id, start, end }) => ({ id, start, end })),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: caller.profile.name ?? caller.profile.username,
  });

  await logAdmin(caller, "study.update", { slots: schedule.slots.length });
  return Response.json({ ok: true });
});
