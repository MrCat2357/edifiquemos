import { initializeApp, getApps, getApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const ADMIN_APP_NAME = "tts-admin";

function ensureInitialized() {
  if (getApps().find((a) => a.name === ADMIN_APP_NAME)) return;

  const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? "")
    .replace(/^"|"$/g, "")
    .replace(/\\n/g, "\n");

  initializeApp(
    {
      credential: cert({
        projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey,
      }),
    },
    ADMIN_APP_NAME
  );
}

ensureInitialized();

export const adminDb = getFirestore(getApp(ADMIN_APP_NAME));