import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  try {
    // Tenta carregar o arquivo JSON local (desenvolvimento)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const serviceAccount = require("./serviceAccount.json");
    initializeApp({ credential: cert(serviceAccount) });
  } catch {
    // Fallback: usa variáveis de ambiente (produção/Vercel)
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