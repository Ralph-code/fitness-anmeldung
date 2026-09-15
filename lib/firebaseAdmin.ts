// Nur auf dem Server verwenden (API-Routen). Der Service-Account darf nie im Browser landen.
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function adminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  const json = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (json) return initializeApp({ credential: cert(JSON.parse(json)) });

  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin Zugangsdaten fehlen: FIREBASE_CLIENT_EMAIL und FIREBASE_PRIVATE_KEY (oder FIREBASE_SERVICE_ACCOUNT) setzen."
    );
  }
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

export const adminAuth = () => getAuth(adminApp());
export const adminDb = () => getFirestore(adminApp());
