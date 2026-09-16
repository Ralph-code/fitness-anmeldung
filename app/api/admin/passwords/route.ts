import { adminDb } from "@/lib/firebaseAdmin";
import { logAdmin } from "@/lib/adminLog";
import { requireAdmin, withErrors } from "@/lib/serverAuth";
import { issuePassword, mapLimit } from "@/lib/students";
import { isAdminProfile } from "@/lib/types";

// Neues Schuljahr: alle Studenten bekommen auf einmal ein neues Passwort
export const POST = withErrors(async (req) => {
  const caller = await requireAdmin(req);
  const users = await adminDb().collection("users").get();
  const uids = users.docs.filter((d) => !isAdminProfile(d.data())).map((d) => d.id);

  const results = await mapLimit(uids, 5, async (uid) => {
    try {
      await issuePassword(uid);
      return true;
    } catch (e) {
      console.error(`Passwort für ${uid} fehlgeschlagen`, e);
      return false;
    }
  });

  const updated = results.filter(Boolean).length;
  await logAdmin(caller, "passwords.rotate", { updated, failed: uids.length - updated });
  return Response.json({ updated, failed: uids.length - updated });
});
