/**
 * lib/reflexoes.ts
 *
 * Tipos, CRUD e queries para reflexões no Firestore.
 *
 * Mudança em relação à versão anterior:
 * - salvarReflexoes agora aceita `imagensCapas: string[]` —
 *   um array com a URL de imagem gerada para cada reflexão individualmente.
 *   Isso permite que cada post de reflexão tenha sua própria capa,
 *   diferente das demais e do sermão original.
 */

import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { gerarSlugUnico } from "./slug";

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
  titulo: string;
  conteudo: string;
  fraseInstigadora: string;
  perguntaReflexiva: string;
  ctaTexto: string;
  imagemCapa: string;        // URL individual por reflexão (gerada por IA ou fallback)
  tipo: "reflexao";
  criadoEm: Timestamp | null;
}

export interface ReflexaoGerada {
  titulo: string;
  conteudo: string;
  fraseInstigadora: string;
  perguntaReflexiva: string;
  ctaTexto: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// salvarReflexoes
// ─────────────────────────────────────────────────────────────────────────────

export async function salvarReflexoes({
  reflexoesGeradas,
  imagensCapas,
  autorId,
  autorNome,
  autorSlug,
  publicacaoOrigemId,
  publicacaoOrigemSlug,
  imagemCapaOrigem,
}: {
  reflexoesGeradas: ReflexaoGerada[];
  /** URL de capa gerada individualmente para cada reflexão (mesmo índice). */
  imagensCapas: string[];
  autorId: string;
  autorNome: string;
  autorSlug: string;
  publicacaoOrigemId: string;
  publicacaoOrigemSlug: string;
  /** Usado como fallback se imagensCapas[i] estiver vazio. */
  imagemCapaOrigem: string;
}): Promise<string[]> {
  const slugsSalvos: string[] = [];

  for (let i = 0; i < reflexoesGeradas.length; i++) {
    const r = reflexoesGeradas[i];
    const slug = await gerarSlugUnico(autorNome, r.titulo);

    // Prioriza a imagem gerada para este microtema; cai no original se vazio
    const imagemCapa = imagensCapas[i] || imagemCapaOrigem;

    const reflexao: Omit<Reflexao, "id"> = {
      slug,
      autorId,
      autorNome,
      autorSlug,
      publicacaoOrigemId,
      publicacaoOrigemSlug,
      titulo: r.titulo,
      conteudo: r.conteudo,
      fraseInstigadora: r.fraseInstigadora,
      perguntaReflexiva: r.perguntaReflexiva,
      ctaTexto: r.ctaTexto,
      imagemCapa,
      tipo: "reflexao",
      criadoEm: serverTimestamp() as Timestamp,
    };

    await addDoc(collection(db, "posts"), reflexao);
    slugsSalvos.push(slug);
  }

  return slugsSalvos;
}

// ─────────────────────────────────────────────────────────────────────────────
// Queries
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