import { adminDb } from "@/lib/firebaseAdmin";
import { isValidAccent } from "@/lib/theme";
import { HttpError, readJson, requireAdmin, withErrors } from "@/lib/serverAuth";

// Akzentfarbe der App – gilt für alle
export const PUT = withErrors(async (req) => {
  const caller = await requireAdmin(req);
  const { accent } = await readJson<{ accent?: unknown }>(req);
  if (!isValidAccent(accent)) throw new HttpError(400, "Farbe ungültig (z.B. #deff9a)");

  const value = accent.toLowerCase();
  await adminDb().doc("settings/theme").set({
    accent: value,
    updatedAt: new Date().toISOString(),
    updatedBy: caller.profile.name ?? caller.profile.username,
  });
  return Response.json({ ok: true });
});
