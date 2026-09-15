import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { isAdminProfile, type UserProfile } from "@/lib/types";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type Caller = { uid: string; profile: UserProfile; isAdmin: boolean };

export async function getCaller(req: Request): Promise<Caller> {
  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpError(401, "Nicht eingeloggt");

  // Außerhalb des try: fehlende Server-Zugangsdaten sind ein 500er, kein Logout-Grund
  const authAdmin = adminAuth();
  let uid: string;
  try {
    // checkRevoked: nach einem Passwortwechsel sind alte Sitzungen sofort ungültig
    uid = (await authAdmin.verifyIdToken(token, true)).uid;
  } catch {
    throw new HttpError(401, "Sitzung abgelaufen");
  }

  const snap = await adminDb().doc(`users/${uid}`).get();
  if (!snap.exists) throw new HttpError(403, "Kein Profil gefunden");
  const profile = snap.data() as UserProfile;
  return { uid, profile, isAdmin: isAdminProfile(profile) };
}

export async function requireAdmin(req: Request) {
  const caller = await getCaller(req);
  if (!caller.isAdmin) throw new HttpError(403, "Nur für Admins");
  return caller;
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Wandelt geworfene Fehler in JSON-Antworten um */
export function withErrors<C>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
      console.error(e);
      return Response.json({ error: "Serverfehler" }, { status: 500 });
    }
  };
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Ungültige Anfrage");
  }
}
