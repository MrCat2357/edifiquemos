import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export interface Reflexao {
  id?: string;
  slug: string;
  autorId: string;
  autorNome: string;
  autorSlug: string;
  publicacaoOrigemId: string;
  publicacaoOrigemSlug: string;
  publicacaoOrigemTipo: "sermao" | "artigo";
  titulo: string;
  conteudo: string;
  fraseInstigadora: string;
  perguntaReflexiva: string;
  ctaTexto: string;
  imagemCapa: string;
  // Atribuição obrigatória do Unsplash
  imagemFotografoNome?: string;
  imagemFotografoUrl?: string;
  imagemUnsplashUrl?: string;
  tipo: "reflexao";
  criadoEm: Timestamp | null;
  editadoEm?: Timestamp | Date | null;
  // Engajamento — opcionais: documentos antigos não têm esses campos
  likes?: number;
  likedBy?: string[];
  commentCount?: number;
}

export interface ReflexaoGerada {
  titulo: string;
  conteudo: string;
  fraseInstigadora: string;
  perguntaReflexiva: string;
  ctaTexto: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Queries — SDK cliente (Client Components apenas)
// ─────────────────────────────────────────────────────────────────────────────

export async function getReflexoesPorAutor(autorId: string): Promise<Reflexao[]> {
  const q = query(
    collection(db, "posts"),
    where("tipo", "==", "reflexao"),
    where("autorId", "==", autorId),
    orderBy("criadoEm", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Reflexao));
}

export async function getReflexoesDaPublicacao(
  publicacaoOrigemId: string
): Promise<Reflexao[]> {
  const q = query(
    collection(db, "posts"),
    where("tipo", "==", "reflexao"),
    where("publicacaoOrigemId", "==", publicacaoOrigemId),
    orderBy("criadoEm", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Reflexao));
}

export async function getReflexaoPorSlug(slug: string): Promise<Reflexao | null> {
  const q = query(
    collection(db, "posts"),
    where("tipo", "==", "reflexao"),
    where("slug", "==", slug)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as Reflexao;
}