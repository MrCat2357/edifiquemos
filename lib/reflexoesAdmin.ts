import { adminDb } from "./firebaseAdmin";
import type { Reflexao } from "./reflexoes";

export async function getReflexaoPorSlugAdmin(slug: string): Promise<Reflexao | null> {
  const snap = await adminDb
    .collection("posts")
    .where("tipo", "==", "reflexao")
    .where("slug", "==", slug)
    .limit(1)
    .get();

  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data();

  return {
    id: d.id,
    ...data,
    criadoEm: null,
    editadoEm: null,
    audioUpdatedAt: null, // Timestamp do Firestore não é serializável pelo Next.js
  } as Reflexao;
}