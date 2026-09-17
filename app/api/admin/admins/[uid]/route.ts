import { deleteAdmin, resetAdminPassword } from "@/lib/admins";
import { HttpError, readJson, requireSuperAdmin, withErrors } from "@/lib/serverAuth";

type Ctx = { params: Promise<{ uid: string }> };

export const PATCH = withErrors<Ctx>(async (req, { params }) => {
  await requireSuperAdmin(req);
  const { uid } = await params;
  const { action } = await readJson<{ action?: string }>(req);
  if (action !== "resetPassword") throw new HttpError(400, "Unbekannte Aktion");
  const password = await resetAdminPassword(uid);
  return Response.json({ password });
});

export const DELETE = withErrors<Ctx>(async (req, { params }) => {
  const caller = await requireSuperAdmin(req);
  const { uid } = await params;
  await deleteAdmin(uid, caller.uid);
  return Response.json({ ok: true });
});
