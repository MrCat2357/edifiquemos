import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  try {
    const serviceAccount = require("./serviceAccount.json");
    initializeApp({ credential: cert(serviceAccount) });
  } catch {
    console.log("[Firebase] PROJECT_ID:", process.env.FIREBASE_ADMIN_PROJECT_ID ?? "UNDEFINED");
    console.log("[Firebase] CLIENT_EMAIL:", process.env.FIREBASE_ADMIN_CLIENT_EMAIL ?? "UNDEFINED");
    console.log("[Firebase] PRIVATE_KEY existe:", !!process.env.FIREBASE_ADMIN_PRIVATE_KEY);

    const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? "")
      .replace(/^"|"$/g, "")
      .replace(/\\n/g, "\n");

    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey,
      }),
    });
  }
}

export const adminDb = getFirestore();