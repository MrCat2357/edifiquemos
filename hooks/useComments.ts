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
  parentId: string | null; // null = comentário raiz; string = reply a outro comentário
  createdAt: Timestamp | null;
};

export function useComments(postId: string) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!postId) return;
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
    parentId: string | null = null
  ) {
    await addDoc(collection(db, "posts", postId, "comments"), {
      text,
      authorId: user.uid,
      authorName: user.displayName || "Anônimo",
      authorPhoto: user.photoURL || "",
      likes: 0,
      likedBy: [],
      parentId,
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

  // Retorna comentários raiz + replies organizados
  const rootComments = comments.filter((c) => !c.parentId);
  const getReplies = (commentId: string) =>
    comments.filter((c) => c.parentId === commentId);

  return { comments, rootComments, getReplies, loading, addComment, toggleLike };
}