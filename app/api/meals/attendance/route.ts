import { setAttendance } from "@/lib/attendanceServer";
import { HttpError, getCaller, readJson, withErrors } from "@/lib/serverAuth";

// Student meldet sich selbst vom Essen ab oder wieder an
export const POST = withErrors(async (req) => {
  const [caller, body] = await Promise.all([getCaller(req), readJson<Record<string, unknown>>(req)]);
  if (caller.isAdmin) throw new HttpError(403, "Admins melden sich hier nicht ab");

  const { date, ...changes } = body;
  await setAttendance({
    uid: caller.uid,
    date: String(date ?? ""),
    changes,
    actor: "student",
    enforceDeadline: true,
  });
  return Response.json({ ok: true });
});
