import { adminDb } from "@/lib/firebaseAdmin";
import { logAdmin } from "@/lib/adminLog";
import { validateOpening } from "@/lib/content";
import { HttpError, readJson, requireAdmin, withErrors } from "@/lib/serverAuth";

// Wöchentliche Öffnungszeiten des Heims
export const PUT = withErrors(async (req) => {
  const caller = await requireAdmin(req);
  const body = await readJson<Record<string, unknown>>(req);

  let opening;
  try {
    opening = validateOpening(body);
  } catch (e) {
    throw new HttpError(400, (e as Error).message);
  }

  await adminDb().doc("settings/opening").set({
    ...opening,
    updatedAt: new Date().toISOString(),
    updatedBy: caller.profile.name ?? caller.profile.username,
  });
  await logAdmin(caller, "opening.update", opening);
  return Response.json({ ok: true });
});
