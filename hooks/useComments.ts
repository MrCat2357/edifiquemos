import { useState, useEffect, useCallback } from "react";
import {
  collection, addDoc, onSnapshot,
  query, orderBy, doc,
  arrayUnion, arrayRemove, increment,
  serverTimestamp, Timestamp,
  runTransaction, limit, startAfter,
  getDocs, getDoc, updateDoc, deleteDoc,
  QueryDocumentSnapshot, DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type Comment = {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  authorPhoto: string;
  authorSlug: string; // resolvido em tempo real — nunca fica desatualizado
  likes: number;
  likedBy: string[];
  parentId: string | null;
  rootId: string | null;
  createdAt: Timestamp | null;
  editedAt: Timestamp | null; // null se nunca editado
};

// Tipo do usuário enriquecido com dados da plataforma
export type CommentUser = {
  uid: string;
  displayName?: string | null;   // nome do Google (fallback)
  photoURL?: string | null;      // foto do Google (fallback)
  platformName?: string | null;  // nome cadastrado na plataforma (ex: "mrcat")
  platformSlug?: string | null;  // slug do perfil (ex: "mrcat")
  platformPhoto?: string | null; // foto do perfil na plataforma
};

const PAGE_SIZE = 20;

/**
 * Busca os slugs atuais de um conjunto de authorIds em lote.
 * Retorna um map { uid → slug }.
 *
 * Por que aqui e não salvo no comentário?
 * O slug vive em /users/{uid}.slug e pode mudar se o usuário editar o perfil.
 * Guardar o slug dentro do comentário criaria dados desnormalizados que ficam
 * desatualizados silenciosamente. Buscar em lote a cada carregamento garante
 * que o link sempre aponta para o perfil correto, com custo de apenas N leituras
 * distintas (onde N = autores únicos nos comentários visíveis no momento).
 */
async function fetchSlugMap(authorIds: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(authorIds)].filter(Boolean);
  if (unique.length === 0) return {};

  const results = await Promise.all(
    unique.map((uid) => getDoc(doc(db, "users", uid)))
  );

  const map: Record<string, string> = {};
  results.forEach((d) => {
    if (d.exists()) {
      map[d.id] = d.data().slug ?? "";
    }
  });
  return map;
}

/** Injeta o authorSlug atual (vindo do slugMap) em cada comentário. */
function injectSlugs(
  docs: QueryDocumentSnapshot<DocumentData>[],
  slugMap: Record<string, string>
): Comment[] {
  return docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      editedAt: data.editedAt ?? null,
      authorSlug: slugMap[data.authorId] ?? "",
    } as Comment;
  });
}

export function useComments(postId: string) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);

  useEffect(() => {
    if (!postId) return;

    setComments([]);
    setLastDoc(null);
    setHasMore(true);
    setLoading(true);

    const q = query(
      collection(db, "posts", postId, "comments"),
      orderBy("createdAt", "asc"),
      limit(PAGE_SIZE * 3)
    );

    const unsub = onSnapshot(q, async (snap) => {
      const authorIds = snap.docs.map((d) => d.data().authorId as string);
      const slugMap = await fetchSlugMap(authorIds);

      setComments(injectSlugs(snap.docs, slugMap));

      if (snap.docs.length > 0) {
        setLastDoc(snap.docs[snap.docs.length - 1]);
      }
      setHasMore(snap.docs.length >= PAGE_SIZE * 3);
      setLoading(false);
    });

    return () => unsub();
  }, [postId]);

  const loadMore = useCallback(async () => {
    if (!lastDoc || loadingMore || !hasMore) return;
    setLoadingMore(true);

    const q = query(
      collection(db, "posts", postId, "comments"),
      orderBy("createdAt", "asc"),
      startAfter(lastDoc),
      limit(PAGE_SIZE * 3)
    );

    const snap = await getDocs(q);
    if (snap.docs.length === 0) {
      setHasMore(false);
    } else {
      const authorIds = snap.docs.map((d) => d.data().authorId as string);
      const slugMap = await fetchSlugMap(authorIds);
      const novos = injectSlugs(snap.docs, slugMap);

      setComments((prev) => {
        const existingIds = new Set(prev.map((c) => c.id));
        return [...prev, ...novos.filter((c) => !existingIds.has(c.id))];
      });
      setLastDoc(snap.docs[snap.docs.length - 1]);
      setHasMore(snap.docs.length >= PAGE_SIZE * 3);
    }

    setLoadingMore(false);
  }, [postId, lastDoc, loadingMore, hasMore]);

  // Usa nome/slug/foto da plataforma; cai no Google só como fallback
  async function addComment(
    text: string,
    user: CommentUser,
    parentId: string | null = null,
    rootId: string | null = null
  ) {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 2000) return;

    await addDoc(collection(db, "posts", postId, "comments"), {
      text: trimmed,
      authorId: user.uid,
      authorName: user.platformName || user.displayName || "Anônimo",
      authorPhoto: user.platformPhoto ?? user.photoURL ?? "",
      // authorSlug não é salvo no documento — resolvido em tempo real via fetchSlugMap
      likes: 0,
      likedBy: [],
      parentId,
      rootId: rootId ?? parentId,
      createdAt: serverTimestamp(),
      editedAt: null,
    });
  }

  /**
   * Edita o texto de um comentário.
   * A regra do Firestore já garante que só o autor pode fazer isso,
   * mas verificamos também no cliente para não nem tentar.
   */
  async function editComment(commentId: string, newText: string, userId: string) {
    const trimmed = newText.trim();
    if (!trimmed || trimmed.length > 2000) return;

    const ref = doc(db, "posts", postId, "comments", commentId);
    // Busca o doc para checar autoria antes de escrever
    const snap = await getDoc(ref);
    if (!snap.exists() || snap.data().authorId !== userId) return;

    await updateDoc(ref, {
      text: trimmed,
      editedAt: serverTimestamp(),
    });
  }

  /**
   * Exclui um comentário.
   * Não exclui as replies em cascata — elas continuam existindo no Firestore
   * mas ficam órfãs (parentId aponta para um doc inexistente).
   * Se quiser ocultar orphans no futuro, filtre no getReplies.
   */
  async function deleteComment(commentId: string, userId: string) {
    const ref = doc(db, "posts", postId, "comments", commentId);
    const snap = await getDoc(ref);
    if (!snap.exists() || snap.data().authorId !== userId) return;

    await deleteDoc(ref);
  }

  /**
   * Likes atômicos via transação — evita race condition entre writes
   * simultâneos que dessincronizariam likes e likedBy.
   */
  async function toggleLike(
    commentId: string,
    userId: string,
    _currentLikes: number,
    _alreadyLiked: boolean
  ) {
    const ref = doc(db, "posts", postId, "comments", commentId);

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists()) return;

      const data = snap.data();
      const likedBy: string[] = data.likedBy ?? [];
      const alreadyLiked = likedBy.includes(userId);

      transaction.update(ref, {
        likes: increment(alreadyLiked ? -1 : 1),
        likedBy: alreadyLiked ? arrayRemove(userId) : arrayUnion(userId),
      });
    });
  }

  // ── Ordenação por relevância ─────────────────────────────────────────────
  const allReplies = comments.filter((c) => c.parentId !== null);

  const replyCount = (commentId: string) =>
    allReplies.filter(
      (r) => r.rootId === commentId || r.parentId === commentId
    ).length;

  const rootComments = comments
    .filter((c) => !c.parentId)
    .sort((a, b) => {
      // 1º critério: mais curtidos primeiro
      const likesDiff = (b.likes ?? 0) - (a.likes ?? 0);
      if (likesDiff !== 0) return likesDiff;

      // 2º critério: mais respondidos primeiro
      const replyDiff = replyCount(b.id) - replyCount(a.id);
      if (replyDiff !== 0) return replyDiff;

      // 3º critério: mais recentes primeiro
      const aTime = a.createdAt?.toMillis() ?? 0;
      const bTime = b.createdAt?.toMillis() ?? 0;
      return bTime - aTime;
    });

  const getReplies = (rootCommentId: string): Comment[] =>
    allReplies.filter(
      (c) => c.rootId === rootCommentId || c.parentId === rootCommentId
    );

  return {
    comments,
    rootComments,
    getReplies,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    addComment,
    editComment,
    deleteComment,
    toggleLike,
  };
}