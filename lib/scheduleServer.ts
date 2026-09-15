import { adminDb } from "@/lib/firebaseAdmin";
import { DEFAULT_SCHEDULE, normalizeSchedule } from "@/lib/schedule";

export const scheduleRef = () => adminDb().doc("settings/schedule");

export async function loadSchedule() {
  const snap = await scheduleRef().get();
  return snap.exists ? normalizeSchedule(snap.data()) : DEFAULT_SCHEDULE;
}
