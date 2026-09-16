import { setAttendance } from "@/lib/attendanceServer";
import { logAdmin } from "@/lib/adminLog";
import { HttpError, readJson, requireAdmin, withErrors } from "@/lib/serverAuth";

// Personal: Status ändern (auch nach der Frist) und Anwesenheit abhaken
export const PATCH = withErrors(async (req) => {
  const caller = await requireAdmin(req);
  const { date, uid, ...changes } = await readJson<Record<string, unknown>>(req);
  const target = String(uid ?? "");
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(target)) throw new HttpError(400, "Student fehlt");

  await setAttendance({
    uid: target,
    date: String(date ?? ""),
    changes,
    actor: caller.profile.name ?? caller.profile.username,
    enforceDeadline: false,
  });
  await logAdmin(caller, "attendance.update", { uid: target, date: String(date ?? ""), ...changes });
  return Response.json({ ok: true });
});
