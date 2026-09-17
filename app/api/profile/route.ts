import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { HttpError, getCaller, readJson, withErrors } from "@/lib/serverAuth";
import { normalizeLanguage } from "@/lib/i18n";
import { isTourId } from "@/lib/tours";

// Kleine Selbst-Änderungen am eigenen Profil
export const PATCH = withErrors(async (req) => {
  const caller = await getCaller(req);
  const { action, theme, language, tour } = await readJson<{ action?: string; theme?: string; language?: string; tour?: string }>(req);
  const db = adminDb();

  switch (action) {
    case "tourSeen": {
      if (!isTourId(tour)) throw new HttpError(400, "Unbekannte Einführung");
      await db.doc(`users/${caller.uid}`).update({ toursSeen: FieldValue.arrayUnion(tour) });
      return Response.json({ ok: true });
    }

    case "resetTours":
      await db.doc(`users/${caller.uid}`).update({ toursSeen: [] });
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
