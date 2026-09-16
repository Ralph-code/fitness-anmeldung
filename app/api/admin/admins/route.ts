import { createAdmin, listAdmins } from "@/lib/admins";
import { logAdmin } from "@/lib/adminLog";
import { readJson, requireSuperAdmin, withErrors } from "@/lib/serverAuth";

// Nur der Superadmin darf Admins sehen und anlegen
export const GET = withErrors(async (req) => {
  await requireSuperAdmin(req);
  return Response.json({ admins: await listAdmins() });
});

export const POST = withErrors(async (req) => {
  const caller = await requireSuperAdmin(req);
  const { name } = await readJson<{ name?: string }>(req);
  const created = await createAdmin(name ?? "");
  await logAdmin(caller, "admin.create", { uid: created.uid, username: created.username, name: created.name });
  return Response.json(created);
});
