import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { logAdmin } from "@/lib/adminLog";
import { validatePost } from "@/lib/content";
import { HttpError, readJson, requireAdmin, withErrors } from "@/lib/serverAuth";

// Neuigkeit / Info für die Startseite anlegen
export const POST = withErrors(async (req) => {
  const caller = await requireAdmin(req);
  const body = await readJson<Record<string, unknown>>(req);

  let data;
  try {
    data = validatePost(body);
  } catch (e) {
    throw new HttpError(400, (e as Error).message);
  }

  const ref = await adminDb().collection("posts").add({
    ...data,
    authorName: caller.profile.name ?? caller.profile.username,
    authorUid: caller.uid,
    createdAt: new Date().toISOString(),
    createdAtTs: FieldValue.serverTimestamp(),
  });
  await logAdmin(caller, "post.create", { title: data.title, category: data.category });
  return Response.json({ id: ref.id });
});
