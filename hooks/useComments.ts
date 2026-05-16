import { useState, useEffect } from "react";
import {
  collection, addDoc, onSnapshot,
  query, orderBy, doc, updateDoc,
  arrayUnion, arrayRemove, increment,
  serverTimestamp, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type Comment = {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  authorPhoto: string;
  likes: number;
  likedBy: string[];
  parentId: string | null;
  rootId: string | null;
  createdAt: Timestamp | null;
};

export function useComments(postId: string) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!postId) return;
    // Busca todos ordenados por data asc — a ordenação de relevância é feita no cliente
    // para não exigir índice composto no Firestore
    const q = query(
      collection(db, "posts", postId, "comments"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setComments(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as Comment))
      );
      setLoading(false);
    });
    return () => unsub();
  }, [postId]);

  async function addComment(
    text: string,
    user: { uid: string; displayName?: string | null; photoURL?: string | null },
    parentId: string | null = null,
    rootId: string | null = null
  ) {
    await addDoc(collection(db, "posts", postId, "comments"), {
      text,
      authorId: user.uid,
      authorName: user.displayName || "Anônimo",
      authorPhoto: user.photoURL || "",
      likes: 0,
      likedBy: [],
      parentId,
      rootId: rootId ?? parentId,
      createdAt: serverTimestamp(),
    });
  }

  async function toggleLike(
    commentId: string,
    userId: string,
    currentLikes: number,
    alreadyLiked: boolean
  ) {
    const ref = doc(db, "posts", postId, "comments", commentId);
    await updateDoc(ref, {
      likes: increment(alreadyLiked ? -1 : 1),
      likedBy: alreadyLiked ? arrayRemove(userId) : arrayUnion(userId),
    });
  }

  // Comentários raiz ordenados por relevância:
  // 1º likes desc — mais curtidos aparecem primeiro
  // 2º replyCount desc — comentários com mais respostas têm mais engajamento
  // 3º createdAt desc — desempate pelo mais recente
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

      // createdAt mais recente primeiro como desempate final
      const aTime = a.createdAt?.toMillis() ?? 0;
      const bTime = b.createdAt?.toMillis() ?? 0;
      return bTime - aTime;
    });

  // Replies mantêm ordem cronológica (asc) — faz sentido seguir o fio da conversa
  const getReplies = (rootCommentId: string): Comment[] =>
    allReplies.filter(
      (c) => c.rootId === rootCommentId || c.parentId === rootCommentId
    );

  return { comments, rootComments, getReplies, loading, addComment, toggleLike };
}