import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyB4VndXA9ohPCK4vKA-xx-PBdlAx66KUsA",
  authDomain: "vozdafe-site.firebaseapp.com",
  projectId: "vozdafe-site",
  storageBucket: "vozdafe-site.firebasestorage.app",
  messagingSenderId: "639470843740",
  appId: "1:639470843740:web:0cd6d940dcd48021fdb399",
  measurementId: "G-RRTGNMXX1L"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

if (typeof window !== "undefined") {
  isSupported().then((yes) => {
    if (yes) getAnalytics(app);
  });
}

setPersistence(auth, browserLocalPersistence);
