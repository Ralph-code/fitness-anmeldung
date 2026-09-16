import { adminDb } from "@/lib/firebaseAdmin";
import { logAdmin } from "@/lib/adminLog";
import { validateMeal } from "@/lib/content";
import { HttpError, readJson, requireAdmin, withErrors } from "@/lib/serverAuth";

// Essensplan für einen Tag speichern (leere Felder löschen den Eintrag)
export const PUT = withErrors(async (req) => {
  const caller = await requireAdmin(req);
  const body = await readJson<Record<string, unknown>>(req);

  let meal;
  try {
    meal = validateMeal(body);
  } catch (e) {
    throw new HttpError(400, (e as Error).message);
  }

  const ref = adminDb().doc(`meals/${meal.date}`);
  if (!meal.lunch && !meal.dinner && !meal.note) {
    await ref.delete();
    await logAdmin(caller, "meal.delete", { date: meal.date });
    return Response.json({ ok: true, deleted: true });
  }

  await ref.set({
    ...meal,
    updatedAt: new Date().toISOString(),
    updatedBy: caller.profile.name ?? caller.profile.username,
  });
  await logAdmin(caller, "meal.update", { date: meal.date });
  return Response.json({ ok: true });
});
