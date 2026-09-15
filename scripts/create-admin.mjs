// Legt das Admin-Konto an oder setzt dessen Passwort neu.
// Aufruf: npm run create-admin -- <benutzername> <passwort>
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const [username, password] = process.argv.slice(2);
if (!username || !password || password.length < 8) {
  console.error("Aufruf: npm run create-admin -- <benutzername> <passwort (min. 8 Zeichen)>");
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

const email = `${username.trim().toLowerCase()}@fitness.local`;
const auth = getAuth();

let user;
try {
  user = await auth.getUserByEmail(email);
  await auth.updateUser(user.uid, { password });
  console.log(`Admin "${username}" existiert – Passwort aktualisiert.`);
} catch (e) {
  if (e.code !== "auth/user-not-found") throw e;
  user = await auth.createUser({ email, password, displayName: "Admin" });
  console.log(`Admin "${username}" angelegt.`);
}

await getFirestore()
  .doc(`users/${user.uid}`)
  .set({ username: username.trim().toLowerCase(), name: "Admin", isAdmin: true }, { merge: true });
