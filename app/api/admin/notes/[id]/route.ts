import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin, withErrors } from "@/lib/serverAuth";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = withErrors<Ctx>(async (req, { params }) => {
  await requireAdmin(req);
  const { id } = await params;
  await adminDb().doc(`notes/${id}`).delete();
  return Response.json({ ok: true });
});
