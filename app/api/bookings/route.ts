import { createBooking, deleteBooking } from "@/lib/bookingsServer";
import { HttpError, getCaller, readJson, withErrors } from "@/lib/serverAuth";
import { getBookingWindow, hasSlotStarted, slotById, slotIdOf } from "@/lib/schedule";

// Student bucht einen Slot für den aktuell buchbaren Tag
export const POST = withErrors(async (req) => {
  const [caller, { slotId }] = await Promise.all([getCaller(req), readJson<{ slotId?: string }>(req)]);
  if (caller.isAdmin) throw new HttpError(403, "Admins buchen nicht");

  await createBooking(caller.uid, slotId);
  return Response.json({ ok: true });
});

// Student storniert die eigene Buchung, Admin entfernt beliebige Buchungen
export const DELETE = withErrors(async (req) => {
  const [caller, { bookingId }] = await Promise.all([getCaller(req), readJson<{ bookingId?: string }>(req)]);
  if (!bookingId) throw new HttpError(400, "Buchung fehlt");

  await deleteBooking(bookingId, (booking, schedule) => {
    if (caller.isAdmin) return;
    if (booking.uid !== caller.uid) throw new HttpError(403, "Nicht deine Buchung");
    const slot = slotById(schedule, slotIdOf(schedule, booking));
    if (!slot || hasSlotStarted(getBookingWindow(schedule), booking.date, slot)) {
      throw new HttpError(409, "Slot schon vorbei");
    }
  });
  return Response.json({ ok: true });
});
