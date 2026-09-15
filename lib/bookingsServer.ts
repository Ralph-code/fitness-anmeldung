import { FieldValue, type DocumentData, type Query, type Transaction } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { HttpError } from "@/lib/serverAuth";
import { loadSchedule } from "@/lib/scheduleServer";
import {
  formatDate, getBookingWindow, hasSlotStarted, isOldEnough, slotById, slotIdOf, suspendedOn, type Schedule,
} from "@/lib/schedule";
import type { Booking, UserProfile } from "@/lib/types";

// days/{date}.counts ist die öffentliche Belegung für Studenten (sie sehen keine fremden Namen).
// Sie wird bei jeder Änderung aus den echten Buchungen neu berechnet und kann so nie auseinanderlaufen.
function writeCounts(tx: Transaction, schedule: Schedule, date: string, bookings: DocumentData[]) {
  const counts: Record<string, number> = {};
  for (const b of bookings) {
    const id = slotIdOf(schedule, b);
    if (id) counts[id] = (counts[id] ?? 0) + 1;
  }
  tx.set(adminDb().doc(`days/${date}`), { date, counts, updatedAt: FieldValue.serverTimestamp() });
}

export async function createBooking(uid: string, slotId: string | undefined) {
  const schedule = await loadSchedule();
  const slot = slotById(schedule, slotId);
  if (!slot) throw new HttpError(400, "Unbekannter Slot");

  const w = getBookingWindow(schedule);
  if (w.phase === "pause") throw new HttpError(409, `Buchung ab ${schedule.opensAt}`);
  if (hasSlotStarted(w, w.date, slot)) throw new HttpError(409, "Slot schon vorbei");

  const db = adminDb();
  const date = w.date;
  // Eine Buchung pro Student pro Tag – erzwungen über die Dokument-ID
  const bookingRef = db.doc(`bookings/${date}_${uid}`);

  await db.runTransaction(async (tx) => {
    const [userSnap, bookingSnap, , daySnap] = await Promise.all([
      tx.get(db.doc(`users/${uid}`)),
      tx.get(bookingRef),
      tx.get(db.doc(`days/${date}`)), // sperrt den Tag gegen gleichzeitige Buchungen
      tx.get(db.collection("bookings").where("date", "==", date)),
    ]);
    const profile = userSnap.data() as UserProfile;

    if (suspendedOn(profile, date)) {
      throw new HttpError(403, `Gesperrt bis ${formatDate(profile.suspendedUntil!, { day: "2-digit", month: "2-digit" })}`);
    }
    if (!isOldEnough(profile, slot, date)) throw new HttpError(403, `Erst ab ${slot.minAge} Jahren`);
    if (bookingSnap.exists) throw new HttpError(409, "Heute schon gebucht");

    const bookings = daySnap.docs.map((d) => d.data());
    if (bookings.filter((b) => slotIdOf(schedule, b) === slot.id).length >= slot.capacity) {
      throw new HttpError(409, "Slot voll");
    }

    const booking = {
      uid,
      name: profile.name ?? profile.username,
      username: profile.username,
      room: profile.room ?? "",
      date,
      slotId: slot.id,
      slot: slot.label,
      createdAt: FieldValue.serverTimestamp(),
    };
    tx.set(bookingRef, booking);
    writeCounts(tx, schedule, date, [...bookings, booking]);
  });
}

export async function deleteBooking(
  bookingId: string,
  guard: (booking: Booking, schedule: Schedule) => void = () => {}
) {
  const schedule = await loadSchedule();
  const db = adminDb();
  const ref = db.doc(`bookings/${bookingId}`);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpError(404, "Buchung nicht gefunden");
    const booking = { id: snap.id, ...snap.data() } as Booking;
    guard(booking, schedule);

    const [, daySnap] = await Promise.all([
      tx.get(db.doc(`days/${booking.date}`)),
      tx.get(db.collection("bookings").where("date", "==", booking.date)),
    ]);
    tx.delete(ref);
    writeCounts(tx, schedule, booking.date, daySnap.docs.filter((d) => d.id !== bookingId).map((d) => d.data()));
    return booking;
  });
}

/**
 * Entfernt noch nicht begonnene Buchungen – eines Studenten (optional bis zu einem Datum)
 * oder aller Studenten in bestimmten Slots. `schedule` = Zeitplan, zu dem die Buchungen gehören.
 */
export async function deleteUpcomingBookings(
  filter: { uid?: string; untilDate?: string; slotIds?: string[] },
  schedule?: Schedule
) {
  schedule ??= await loadSchedule();
  const w = getBookingWindow(schedule);
  let q: Query = adminDb().collection("bookings");
  q = filter.uid ? q.where("uid", "==", filter.uid) : q.where("date", ">=", w.today);

  let removed = 0;
  for (const doc of (await q.get()).docs) {
    const b = doc.data();
    const id = slotIdOf(schedule, b);
    const slot = slotById(schedule, id);
    if (filter.slotIds && !(id && filter.slotIds.includes(id))) continue;
    if (filter.untilDate && b.date > filter.untilDate) continue;
    if (b.date < w.today || (slot && hasSlotStarted(w, b.date, slot))) continue;
    try {
      await deleteBooking(doc.id);
      removed++;
    } catch (e) {
      if (!(e instanceof HttpError && e.status === 404)) throw e;
    }
  }
  return removed;
}
