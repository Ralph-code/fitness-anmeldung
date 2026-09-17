import { randomInt } from "node:crypto";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { deleteUpcomingBookings } from "@/lib/bookingsServer";
import { HttpError } from "@/lib/serverAuth";
import { isValidRoom, normalizeRoom, parseBirthDate, toUsername, usernameToEmail } from "@/lib/schedule";
import { isAdminProfile, type UserProfile } from "@/lib/types";

// Ohne verwechselbare Zeichen (0/o, 1/l/i), damit man es vom Zettel abtippen kann
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function generatePassword(groups = 2) {
  const pick = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return Array.from({ length: groups }, pick).join("-");
}

/** Setzt ein neues Passwort, meldet alle offenen Sitzungen ab und speichert es für den Ausdruck */
export async function issuePassword(uid: string) {
  const password = generatePassword();
  await adminAuth().updateUser(uid, { password });
  await adminAuth().revokeRefreshTokens(uid);
  await adminDb().doc(`credentials/${uid}`).set({ password, issuedAt: new Date().toISOString() });
  return password;
}

export type StudentInput = {
  name: string;
  room: string;
  birthDate: string;
};

export function validateStudent(input: Partial<StudentInput>): StudentInput {
  const name = (input.name ?? "").trim().replace(/\s+/g, " ");
  const room = normalizeRoom(input.room ?? "");
  const birthDate = parseBirthDate(input.birthDate ?? "");
  if (toUsername(name).length < 2) throw new HttpError(400, "Name fehlt");
  if (!isValidRoom(room)) throw new HttpError(400, `Zimmer "${input.room ?? ""}" ungültig (z.B. 101 oder 101A)`);
  if (!birthDate) throw new HttpError(400, `Geburtsdatum für ${name} ungültig`);

  return { name, room, birthDate };
}

export async function getStudent(uid: string) {
  const snap = await adminDb().doc(`users/${uid}`).get();
  const profile = snap.data() as UserProfile | undefined;
  if (!profile) throw new HttpError(404, "Student nicht gefunden");
  if (isAdminProfile(profile)) throw new HttpError(403, "Admin-Konto kann hier nicht geändert werden");
  return profile;
}

export async function isUsernameFree(username: string) {
  try {
    await adminAuth().getUserByEmail(usernameToEmail(username));
    return false;
  } catch (e) {
    if ((e as { code?: string }).code === "auth/user-not-found") return true;
    throw e;
  }
}

/** Legt Auth-Konto, Profil und Zugangsdaten an. taken = bereits vergebene Benutzernamen */
export async function createStudent(input: StudentInput, taken: Set<string>) {
  const base = toUsername(input.name);
  let username = base;
  for (let i = 2; taken.has(username) || !(await isUsernameFree(username)); i++) {
    taken.add(username);
    username = `${base}${i}`;
  }
  taken.add(username);

  const password = generatePassword();
  const { uid } = await adminAuth().createUser({
    email: usernameToEmail(username),
    password,
    displayName: input.name,
  });

  const db = adminDb();
  const batch = db.batch();
  batch.set(db.doc(`users/${uid}`), {
    ...input,
    username,
    isAdmin: false,
    approved: false,
    suspendedUntil: null,
    suspendReason: null,
    createdAt: new Date().toISOString(),
  });
  batch.set(db.doc(`credentials/${uid}`), { password, issuedAt: new Date().toISOString() });
  await batch.commit();

  return { uid, username, password, ...input };
}

/** Löscht Studenten komplett: offene Buchungen, Login, Profil und Zugangsdaten. Admins werden übersprungen. */
export async function deleteStudents(uids: string[]) {
  const db = adminDb();
  const snaps = uids.length ? await db.getAll(...uids.map((uid) => db.doc(`users/${uid}`))) : [];
  const targets = snaps.filter((s) => s.exists && !isAdminProfile(s.data())).map((s) => s.id);
  if (targets.length === 0) return { deleted: 0, failed: 0 };

  await deleteUpcomingBookings({ uids: targets });

  const failed = new Set<number>();
  for (let i = 0; i < targets.length; i += 1000) {
    const res = await adminAuth().deleteUsers(targets.slice(i, i + 1000));
    res.errors.forEach((e) => failed.add(i + e.index));
  }

  const deleted = targets.filter((_, i) => !failed.has(i));
  for (let i = 0; i < deleted.length; i += 200) {
    const batch = db.batch();
    for (const uid of deleted.slice(i, i + 200)) {
      batch.delete(db.doc(`users/${uid}`));
      batch.delete(db.doc(`credentials/${uid}`));
    }
    await batch.commit();
  }
  return { deleted: deleted.length, failed: failed.size };
}

export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
