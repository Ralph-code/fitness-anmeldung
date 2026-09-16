import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { HttpError } from "@/lib/serverAuth";
import { toUsername, usernameToEmail } from "@/lib/schedule";
import { generatePassword, isUsernameFree } from "@/lib/students";
import { isAdminProfile, isSuperAdminProfile, type AdminRecord, type UserProfile } from "@/lib/types";

/** Superadmins sind absichtlich nur über das Terminal änderbar (scripts/create-superadmin.mjs) */
async function getAdmin(uid: string) {
  const snap = await adminDb().doc(`users/${uid}`).get();
  const profile = snap.data() as UserProfile | undefined;
  if (!profile || !isAdminProfile(profile)) throw new HttpError(404, "Admin nicht gefunden");
  if (isSuperAdminProfile(profile)) throw new HttpError(403, "Superadmin nur im Terminal änderbar");
  return profile;
}

export async function listAdmins(): Promise<AdminRecord[]> {
  const snap = await adminDb().collection("users").get();
  const admins = snap.docs.filter((d) => isAdminProfile(d.data() as UserProfile));

  const records = await Promise.all(
    admins.map(async (d) => {
      const data = d.data() as UserProfile;
      let lastSignIn: string | null = null;
      try {
        lastSignIn = (await adminAuth().getUser(d.id)).metadata.lastSignInTime ?? null;
      } catch {
        lastSignIn = null;
      }
      // Ältere Konten haben teils weder Name noch Benutzername gespeichert
      return {
        uid: d.id,
        username: data.username ?? "—",
        name: data.name || data.username || "Unbenannt",
        isSuperAdmin: isSuperAdminProfile(data),
        createdAt: data.createdAt ?? null,
        lastSignIn,
      };
    })
  );

  return records.sort(
    (a, b) => Number(b.isSuperAdmin) - Number(a.isSuperAdmin) || a.name.localeCompare(b.name, "de")
  );
}

export async function createAdmin(nameInput: string) {
  const name = (nameInput ?? "").trim().replace(/\s+/g, " ");
  const base = toUsername(name);
  if (base.length < 2) throw new HttpError(400, "Name fehlt");

  const existing = await adminDb().collection("users").get();
  const taken = new Set(existing.docs.map((d) => d.data().username as string));
  let username = base;
  for (let i = 2; taken.has(username) || !(await isUsernameFree(username)); i++) {
    taken.add(username);
    username = `${base}${i}`;
  }

  // Länger als Studenten-Passwörter und bewusst nirgends gespeichert
  const password = generatePassword(3);
  const { uid } = await adminAuth().createUser({ email: usernameToEmail(username), password, displayName: name });
  await adminDb().doc(`users/${uid}`).set({
    username,
    name,
    isAdmin: true,
    isSuperAdmin: false,
    createdAt: new Date().toISOString(),
  });

  return { uid, username, name, password };
}

export async function resetAdminPassword(uid: string) {
  await getAdmin(uid);
  const password = generatePassword(3);
  await adminAuth().updateUser(uid, { password });
  await adminAuth().revokeRefreshTokens(uid);
  return password;
}

export async function deleteAdmin(uid: string, callerUid: string) {
  if (uid === callerUid) throw new HttpError(403, "Eigenes Konto nicht löschbar");
  await getAdmin(uid);
  try {
    await adminAuth().deleteUser(uid);
  } catch (e) {
    if ((e as { code?: string }).code !== "auth/user-not-found") throw e;
  }
  const db = adminDb();
  await Promise.all([db.doc(`users/${uid}`).delete(), db.doc(`credentials/${uid}`).delete()]);
}
