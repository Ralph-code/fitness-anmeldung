import { FieldValue } from "firebase-admin/firestore";
import { deleteUpcomingBookings } from "@/lib/bookingsServer";
import { loadSchedule, scheduleRef } from "@/lib/scheduleServer";
import { HttpError, readJson, requireAdmin, withErrors } from "@/lib/serverAuth";
import { validateSchedule, type Schedule } from "@/lib/schedule";

// Admin speichert den Zeitplan (Slots, Plätze, Altersgrenzen, Buchungsstart)
export const PUT = withErrors(async (req) => {
  await requireAdmin(req);
  const body = await readJson<{ opensAt?: unknown; slots?: unknown }>(req);

  let schedule: Schedule;
  try {
    schedule = validateSchedule(body);
  } catch (e) {
    throw new HttpError(400, (e as Error).message);
  }

  const previous = await loadSchedule();
  const removedIds = previous.slots.filter((s) => !schedule.slots.some((n) => n.id === s.id)).map((s) => s.id);

  await scheduleRef().set({
    opensAt: schedule.opensAt,
    slots: schedule.slots.map(({ id, start, end, capacity, minAge }) => ({ id, start, end, capacity, minAge })),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Offene Buchungen in gelöschten Slots stornieren (Zeiten stammen noch aus dem alten Plan)
  const removed = removedIds.length ? await deleteUpcomingBookings({ slotIds: removedIds }, previous) : 0;
  return Response.json({ ok: true, removed });
});
