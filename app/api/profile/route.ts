import { adminDb } from "@/lib/firebaseAdmin";
import { HttpError, getCaller, readJson, withErrors } from "@/lib/serverAuth";
import { normalizeLanguage } from "@/lib/i18n";

// Kleine Selbst-Änderungen am eigenen Profil
export const PATCH = withErrors(async (req) => {
  const caller = await getCaller(req);
  const { action, theme, language } = await readJson<{ action?: string; theme?: string; language?: string }>(req);
  const db = adminDb();

  switch (action) {
    case "tutorialSeen":
      await db.doc(`users/${caller.uid}`).update({ tutorialSeenAt: new Date().toISOString() });
      return Response.json({ ok: true });

    case "resetTutorial":
      await db.doc(`users/${caller.uid}`).update({ tutorialSeenAt: null });
      return Response.json({ ok: true });

    // Nach eigener Passwortänderung: gespeichertes Zettel-Passwort gilt nicht mehr
    case "passwordChanged":
      await db.doc(`credentials/${caller.uid}`).set(
        { changedByUser: true, changedAt: new Date().toISOString() },
        { merge: true }
      );
      return Response.json({ ok: true });

    case "setTheme": {
      if (theme !== "light" && theme !== "dark") throw new HttpError(400, "Ansicht ungültig");
      await db.doc(`users/${caller.uid}`).update({ theme });
      return Response.json({ ok: true });
    }

    case "setLanguage": {
      if (language !== "de" && language !== "it") throw new HttpError(400, "Sprache ungültig");
      await db.doc(`users/${caller.uid}`).update({ language: normalizeLanguage(language) });
      return Response.json({ ok: true });
    }

    default:
      throw new HttpError(400, "Unbekannte Aktion");
  }
});
