import { createAdmin, listAdmins } from "@/lib/admins";
import { readJson, requireSuperAdmin, withErrors } from "@/lib/serverAuth";

// Nur der Superadmin darf Admins sehen und anlegen
export const GET = withErrors(async (req) => {
  await requireSuperAdmin(req);
  return Response.json({ admins: await listAdmins() });
});

export const POST = withErrors(async (req) => {
  await requireSuperAdmin(req);
  const { name } = await readJson<{ name?: string }>(req);
  const created = await createAdmin(name ?? "");
  return Response.json(created);
});
