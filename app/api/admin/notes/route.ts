import { adminDb } from "@/lib/firebaseAdmin";
import { logAdmin } from "@/lib/adminLog";
import { validateNote } from "@/lib/content";
import { HttpError, readJson, requireAdmin, withErrors } from "@/lib/serverAuth";
import { isAdminProfile } from "@/lib/types";

// Vermerk zu einem Studenten (Verweis, Lob, Notiz) – sichtbar im Profil des Studenten
export const POST = withErrors(async (req) => {
  const caller = await requireAdmin(req);
  const body = await readJson<Record<string, unknown>>(req);

  let note;
  try {
    note = validateNote(body);
  } catch (e) {
    throw new HttpError(400, (e as Error).message);
  }

  const target = await adminDb().doc(`users/${note.uid}`).get();
  if (!target.exists) throw new HttpError(404, "Student nicht gefunden");
  if (isAdminProfile(target.data())) throw new HttpError(403, "Nur für Studenten");

  const ref = await adminDb().collection("notes").add({
    ...note,
    authorName: caller.profile.name ?? caller.profile.username,
    authorUid: caller.uid,
    createdAt: new Date().toISOString(),
  });
  await logAdmin(caller, "note.create", { uid: note.uid, type: note.type, name: target.data()?.name });
  return Response.json({ id: ref.id });
});
