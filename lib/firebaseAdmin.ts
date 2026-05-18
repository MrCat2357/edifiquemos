import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  const isProd = process.env.NODE_ENV === "production"
    || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === "vozdafe-site";

  try {
    // Tenta carregar o arquivo local correspondente ao ambiente
    const fileName = isProd
      ? "./serviceAccount.production.json"
      : "./serviceAccount.staging.json";
    const serviceAccount = require(fileName);
    initializeApp({ credential: cert(serviceAccount) });
  } catch {
    // Fallback: variáveis de ambiente (usado na Vercel)
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