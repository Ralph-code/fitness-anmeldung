import { adminDb } from "@/lib/firebaseAdmin";
import { logAdmin } from "@/lib/adminLog";
import { validateCalendarRange } from "@/lib/content";
import { HttpError, readJson, requireAdmin, withErrors } from "@/lib/serverAuth";

// Ausnahmen im Kalender: geschlossen, abweichende Zeiten, schulfrei.
// "date" ist der erste Tag, "dateTo" optional der letzte – dazwischen wird jeder Tag eingetragen.
export const PUT = withErrors(async (req) => {
  const caller = await requireAdmin(req);
  const body = await readJson<Record<string, unknown>>(req);

  let range;
  try {
    range = validateCalendarRange(body);
  } catch (e) {
    throw new HttpError(400, (e as Error).message);
  }

  const { entry, days, from, to } = range;
  const db = adminDb();
  const batch = db.batch();
  const isEmpty = !entry.closed && !entry.schoolFree && !entry.openTime && !entry.closeTime && !entry.label && !entry.note;

  for (const date of days) {
    const ref = db.doc(`calendar/${date}`);
    if (isEmpty) batch.delete(ref);
    else
      batch.set(ref, {
        ...entry,
        date,
        updatedAt: new Date().toISOString(),
        updatedBy: caller.profile.name ?? caller.profile.username,
      });
  }
  await batch.commit();

  await logAdmin(caller, isEmpty ? "calendar.delete" : "calendar.update", {
    from,
    to,
    days: days.length,
    label: entry.label || undefined,
    closed: entry.closed || undefined,
    schoolFree: entry.schoolFree || undefined,
  });

  return Response.json({ ok: true, days: days.length, deleted: isEmpty });
});
