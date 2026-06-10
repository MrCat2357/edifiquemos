/**
 * lib/audioQueue.ts
 *
 * Utilitários compartilhados para construção da fila de áudio.
 *
 * Responsabilidades:
 *  - Tipo FeedNavItem (feed global misturado)
 *  - fetchFeedGlobal  — busca posts + séries + reflexões ordenados por data
 *  - buildAudioQueueFromFeed — monta fila PLANA expandindo séries inline
 *
 * PROBLEMA 1 resolvido aqui:
 *  Séries não são mais filtradas: cada série é substituída pelos seus
 *  episódios na ordem em que aparecem em `postIds`, resultando em uma
 *  fila plana do tipo:
 *    post, post, reflexao, ep1_serie, ep2_serie, ep3_serie, reflexao, post
 */

import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  doc,
} from "firebase/firestore";
import type { AudioPublication } from "@/providers/AudioProvider";

// ── Constante compartilhada ──────────────────────────────────────────────────

export const FALLBACK_AUDIO =
  "https://archive.org/download/testmp3testfile/mpthreetest.mp3"; // ← ALTERADO (movido para cá)

// ── Tipo de item do feed global ──────────────────────────────────────────────

export type FeedNavItem = {
  id: string;
  _feedType: "post" | "serie" | "reflexao";
  titulo: string;
  slug?: string;
  tipo?: string;
  autorId?: string;
  autorNome?: string;
  autorSlug?: string;
  audioUrl?: string;
  // Séries: postIds vem do spread do Firestore
  postIds?: string[];
  // Campos de data para ordenação
  data?: any;
  criadoEm?: any;
};

// ── Helpers internos ─────────────────────────────────────────────────────────

function getDataValor(item: FeedNavItem): number {
  const d = (item as any).criadoEm ?? (item as any).data;
  if (!d) return 0;
  if (d?.toDate) return d.toDate().getTime();
  if (typeof d === "string") return new Date(d).getTime();
  return 0;
}

// ── fetchFeedGlobal ──────────────────────────────────────────────────────────

/**
 * Retorna posts + séries + reflexões mesclados e ordenados por data DESC.
 * Séries carregam o campo `postIds` (e quaisquer outros campos do Firestore)
 * via spread, permitindo a expansão posterior.
 */
export async function fetchFeedGlobal(): Promise<FeedNavItem[]> {
  const [postsSnap, seriesSnap, reflexoesSnap] = await Promise.all([
    getDocs(
      query(
        collection(db, "posts"),
        where("tipo", "in", ["sermao", "artigo"]),
        orderBy("data", "desc")
      )
    ),
    getDocs(query(collection(db, "series"), orderBy("criadoEm", "desc"))),
    getDocs(
      query(
        collection(db, "posts"),
        where("tipo", "==", "reflexao"),
        orderBy("criadoEm", "desc")
      )
    ),
  ]);

  const posts: FeedNavItem[] = [];
  postsSnap.forEach((d) =>
    posts.push({ id: d.id, _feedType: "post", ...d.data() } as FeedNavItem)
  );

  const series: FeedNavItem[] = [];
  seriesSnap.forEach((d) =>
    // ← ALTERADO: spread inclui `postIds` sem necessidade de campo extra
    series.push({ id: d.id, _feedType: "serie", ...d.data() } as FeedNavItem)
  );

  const reflexoes: FeedNavItem[] = [];
  reflexoesSnap.forEach((d) =>
    reflexoes.push({
      id: d.id,
      _feedType: "reflexao",
      ...d.data(),
    } as FeedNavItem)
  );

  return [...posts, ...series, ...reflexoes].sort(
    (a, b) => getDataValor(b) - getDataValor(a)
  );
}

// ── feedItemUrl / feedItemLabel (helpers de navegação de página) ─────────────

export function feedItemUrl(item: FeedNavItem, fromParam: string): string {
  const from = fromParam || "home";
  if (item._feedType === "serie") return `/series/${item.slug ?? item.id}?from=${from}`;
  if (item._feedType === "reflexao") {
    const aSlug = item.autorSlug ?? item.autorId ?? "";
    return `/${aSlug}/reflexao/${item.slug ?? item.id}?from=${from}`;
  }
  const cat = item.tipo === "sermao" ? "sermoes" : "estudos";
  return `/posts/${cat}/${item.slug ?? item.id}?from=${from}`;
}

export function feedItemLabel(
  item: FeedNavItem,
  direction: "prev" | "next"
): string {
  const prefix = direction === "prev" ? "Anterior" : "Próximo";
  if (item._feedType === "serie") return `${prefix}: série`;
  if (item._feedType === "reflexao")
    return `Reflexão ${direction === "prev" ? "anterior" : "próxima"}`;
  if (item.tipo === "sermao")
    return `Sermão ${direction === "prev" ? "anterior" : "próximo"}`;
  return `Estudo ${direction === "prev" ? "anterior" : "próximo"}`;
}

// ── Expansão de série ────────────────────────────────────────────────────────

/**
 * Dado um item de série do feed, retorna os episódios como AudioPublication[].
 *
 * PROBLEMA 1: séries são expandidas inline em vez de filtradas.
 *
 * Estratégia:
 *  1. Usa `postIds` do próprio item (já disponível via spread do Firestore).
 *  2. Se `postIds` estiver vazio (documento desatualizado), faz re-fetch.
 *  3. Busca cada post individualmente e monta AudioPublication.
 */
async function expandSerie(item: FeedNavItem): Promise<AudioPublication[]> {
  let postIds: string[] = item.postIds ?? []; // ← ALTERADO: vem do spread

  if (postIds.length === 0) {
    // Re-fetch da série caso postIds não tenha vindo no spread
    try {
      const serieSnap = await getDoc(doc(db, "series", item.id));
      if (!serieSnap.exists()) return [];
      postIds = serieSnap.data().postIds ?? [];
    } catch {
      return [];
    }
  }

  if (postIds.length === 0) return [];

  const snaps = await Promise.all(
    postIds.map((id) => getDoc(doc(db, "posts", id)))
  );

  return snaps
    .filter((s) => s.exists())
    .map((s) => {
      const d = s.data();
      return {
        id: s.id,
        tipo: (d.tipo ?? "sermao") as AudioPublication["tipo"],
        titulo: d.titulo || "Sem título",
        autorNome: d.autorNome || "Autor",
        autorFoto: d.autorFoto ?? null,
        slug: d.slug ?? s.id,
        autorSlug: d.autorSlug,
        audioUrl: d.audioUrl || FALLBACK_AUDIO,
      } as AudioPublication;
    });
}

// ── buildAudioQueueFromFeed ──────────────────────────────────────────────────

/**
 * Converte itens do feed global em uma fila de áudio PLANA.
 *
 * PROBLEMA 1 resolvido:
 *  - Posts e reflexões viram AudioPublication diretamente.
 *  - Séries são expandidas inline via `expandSerie`:
 *      [..., ep1, ep2, ep3, ...]  em vez de [..., serie, ...]
 *
 * @param items  Resultado de fetchFeedGlobal()
 */
export async function buildAudioQueueFromFeed( // ← ALTERADO (nova função)
  items: FeedNavItem[]
): Promise<AudioPublication[]> {
  const result: AudioPublication[] = [];

  for (const item of items) {
    if (item._feedType === "serie") {
      // ← ALTERADO: expande série inline em vez de filtrar
      const episodes = await expandSerie(item);
      result.push(...episodes);
    } else {
      result.push({
        id: item.id,
        tipo: (item.tipo ?? "sermao") as AudioPublication["tipo"],
        titulo: item.titulo,
        autorNome: item.autorNome || "Autor",
        autorFoto: null,
        slug: item.slug ?? item.id,
        autorSlug: item.autorSlug,
        audioUrl: item.audioUrl || FALLBACK_AUDIO,
      });
    }
  }

  return result;
}