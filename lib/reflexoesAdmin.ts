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

  // Converte o Timestamp do Admin SDK para null antes de passar ao Client Component
  // O campo criadoEm não é usado na UI, então null é seguro aqui
  return {
    id: d.id,
    ...data,
    criadoEm: null,
  } as Reflexao;
}