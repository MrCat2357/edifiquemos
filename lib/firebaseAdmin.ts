import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const serviceAccount = require("./serviceAccount.json");

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

export const adminDb = getFirestore();