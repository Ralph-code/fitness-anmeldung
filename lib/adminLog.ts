import { adminDb } from "@/lib/firebaseAdmin";
import type { Caller } from "@/lib/serverAuth";

/**
 * Protokolliert Änderungen von Admins (wer, wann, was) – sichtbar unter Verwaltung → Protokoll.
 * Schlägt das Protokoll fehl, darf die eigentliche Aktion trotzdem gelten.
 */
export async function logAdmin(caller: Caller, action: string, details: Record<string, unknown> = {}) {
  try {
    const clean = Object.fromEntries(Object.entries(details).filter(([, v]) => v !== undefined));
    await adminDb().collection("adminLog").add({
      action,
      details: clean,
      actorUid: caller.uid,
      actorName: caller.profile.name ?? caller.profile.username,
      at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("adminLog fehlgeschlagen:", e);
  }
}
