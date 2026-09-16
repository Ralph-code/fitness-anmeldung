import { acknowledgeMissedMeal } from "@/lib/attendanceServer";
import { HttpError, getCaller, readJson, withErrors } from "@/lib/serverAuth";
import { MEAL_KEYS } from "@/lib/meals";
import type { MealKey } from "@/lib/content";

// Student bestätigt eine Fehlmeldung ("war nicht beim Essen, obwohl angemeldet")
export const POST = withErrors(async (req) => {
  const [caller, { date, meal }] = await Promise.all([
    getCaller(req),
    readJson<{ date?: string; meal?: string }>(req),
  ]);

  if (!MEAL_KEYS.includes(meal as MealKey)) throw new HttpError(400, "Mahlzeit fehlt");
  await acknowledgeMissedMeal(caller.uid, String(date ?? ""), meal as MealKey);
  return Response.json({ ok: true });
});
