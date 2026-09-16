import { adminDb } from "@/lib/firebaseAdmin";
import { logAdmin } from "@/lib/adminLog";
import { validatePost } from "@/lib/content";
import { HttpError, readJson, requireAdmin, withErrors } from "@/lib/serverAuth";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withErrors<Ctx>(async (req, { params }) => {
  const caller = await requireAdmin(req);
  const { id } = await params;
  const ref = adminDb().doc(`posts/${id}`);
  const before = await ref.get();
  if (!before.exists) throw new HttpError(404, "Beitrag nicht gefunden");

  const body = await readJson<Record<string, unknown>>(req);
  let data;
  try {
    data = validatePost(body);
  } catch (e) {
    throw new HttpError(400, (e as Error).message);
  }

  await ref.update({ ...data, updatedAt: new Date().toISOString() });
  await logAdmin(caller, "post.update", { id, title: data.title });
  return Response.json({ ok: true });
});

export const DELETE = withErrors<Ctx>(async (req, { params }) => {
  const caller = await requireAdmin(req);
  const { id } = await params;
  const snap = await adminDb().doc(`posts/${id}`).get();
  await adminDb().doc(`posts/${id}`).delete();
  await logAdmin(caller, "post.delete", { id, title: snap.data()?.title });
  return Response.json({ ok: true });
});
