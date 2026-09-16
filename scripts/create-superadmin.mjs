// Legt den Superadmin an, setzt dessen Passwort neu oder stuft ein bestehendes Konto hoch.
// Superadmins können in der App Admins anlegen und löschen – und sind nur hier im Terminal änderbar.
// Aufruf: npm run create-superadmin -- <benutzername> <passwort>
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const [usernameArg, password] = process.argv.slice(2);
const username = usernameArg?.trim().toLowerCase();

if (!username || !password || password.length < 10) {
  console.error("Aufruf: npm run create-superadmin -- <benutzername> <passwort (min. 10 Zeichen)>");
  process.exit(1);
}
if (!/^[a-z0-9.]{2,40}$/.test(username)) {
  console.error("Benutzername: nur Kleinbuchstaben, Zahlen und Punkte, z.B. ralph oder ralph.r");
  process.exit(1);
}

const json = process.env.FIREBASE_SERVICE_ACCOUNT;
const credential = json
  ? cert(JSON.parse(json))
  : cert({
      projectId: process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    });
initializeApp({ credential });

const auth = getAuth();
const db = getFirestore();
const email = `${username}@fitness.local`;

let user;
try {
  user = await auth.getUserByEmail(email);
  await auth.updateUser(user.uid, { password });
  await auth.revokeRefreshTokens(user.uid);
  console.log(`Konto "${username}" existiert – Passwort aktualisiert.`);
} catch (e) {
  if (e.code !== "auth/user-not-found") throw e;
  user = await auth.createUser({ email, password, displayName: "Superadmin" });
  console.log(`Konto "${username}" angelegt.`);
}

const existing = (await db.doc(`users/${user.uid}`).get()).data();
await db.doc(`users/${user.uid}`).set(
  {
    username,
    name: existing?.name ?? "Superadmin",
    isAdmin: true,
    isSuperAdmin: true,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  },
  { merge: true }
);

console.log(`Superadmin-Rechte gesetzt. Login: ${username}`);
process.exit(0);
