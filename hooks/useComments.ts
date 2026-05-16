import { useState, useEffect, useCallback } from "react";
import {
  collection, addDoc, onSnapshot,
  query, orderBy, doc,
  arrayUnion, arrayRemove, increment,
  serverTimestamp, Timestamp,
  runTransaction, limit, startAfter,
  getDocs, QueryDocumentSnapshot, DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type Comment = {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  authorPhoto: string;
  authorSlug: string; // NOVO: slug do perfil na plataforma
  likes: number;
  likedBy: string[];
  parentId: string | null;
  rootId: string | null;
  createdAt: Timestamp | null;
};

// Tipo do usuário enriquecido com dados da plataforma
export type CommentUser = {
  uid: string;
  displayName?: string | null;  // nome do Google (fallback)
  photoURL?: string | null;     // foto do Google (fallback)
  platformName?: string | null; // nome cadastrado na plataforma (ex: "mrcat")
  platformSlug?: string | null; // slug do perfil (ex: "mrcat")
  platformPhoto?: string | null;// foto do perfil na plataforma
};

const PAGE_SIZE = 20; // comentários raiz por página

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

    // CORREÇÃO 2 — Paginação.
    // Em vez de baixar todos os comentários de uma vez (onSnapshot irrestrito),
    // carregamos apenas os primeiros PAGE_SIZE * 3 documentos.
    // O fator 3 existe porque a coleção mistura raiz + replies —
    // precisamos de margem para garantir PAGE_SIZE comentários raiz visíveis.
    const q = query(
      collection(db, "posts", postId, "comments"),
      orderBy("createdAt", "asc"),
      limit(PAGE_SIZE * 3)
    );

    const unsub = onSnapshot(q, (snap) => {
      setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Comment)));
      if (snap.docs.length > 0) {
        setLastDoc(snap.docs[snap.docs.length - 1]);
      }
      setHasMore(snap.docs.length >= PAGE_SIZE * 3);
      setLoading(false);
    });

    return () => unsub();
  }, [postId]);

  // Carrega a próxima página manualmente (botão "Ver mais comentários")
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
      setComments((prev) => {
        const existingIds = new Set(prev.map((c) => c.id));
        const novos = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Comment))
          .filter((c) => !existingIds.has(c.id));
        return [...prev, ...novos];
      });
      setLastDoc(snap.docs[snap.docs.length - 1]);
      setHasMore(snap.docs.length >= PAGE_SIZE * 3);
    }

    setLoadingMore(false);
  }, [postId, lastDoc, loadingMore, hasMore]);

  // CORREÇÃO 3 — Usar nome/slug/foto da plataforma, não os do Google.
  // platformName, platformSlug e platformPhoto vêm do documento /users/{uid}
  // no Firestore. O fallback para displayName/photoURL do Google só ocorre
  // se os dados da plataforma não estiverem disponíveis.
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
      authorSlug: user.platformSlug || "",
      likes: 0,
      likedBy: [],
      parentId,
      rootId: rootId ?? parentId,
      createdAt: serverTimestamp(),
    });
  }

  /**
   * CORREÇÃO 1 — Likes atômicos via transação.
   *
   * Problema anterior: dois updateDoc simultâneos podiam causar race condition
   * no array likedBy — um write sobrescrevia o outro, deixando likes e likedBy
   * dessincronizados (ex: likes = 5 mas likedBy só tem 3 entradas).
   *
   * Solução: runTransaction lê o estado atual do documento atomicamente antes
   * de escrever. Se outro cliente modificou o doc entre o read e o write,
   * o Firestore rejeita e retenta automaticamente — garantindo consistência.
   */
  async function toggleLike(
    commentId: string,
    userId: string,
    _currentLikes: number,  // ignorado — lemos o valor real dentro da transação
    _alreadyLiked: boolean  // ignorado — verificamos dentro da transação
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

  // Ordenação por relevância no cliente
  const allReplies = comments.filter((c) => c.parentId !== null);

  const replyCount = (commentId: string) =>
    allReplies.filter((r) => r.rootId === commentId || r.parentId === commentId).length;

  const rootComments = comments
    .filter((c) => !c.parentId)
    .sort((a, b) => {
      const likesDiff = (b.likes ?? 0) - (a.likes ?? 0);
      if (likesDiff !== 0) return likesDiff;

      const replyDiff = replyCount(b.id) - replyCount(a.id);
      if (replyDiff !== 0) return replyDiff;

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
    toggleLike,
  };
}