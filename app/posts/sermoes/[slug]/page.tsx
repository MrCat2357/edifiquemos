"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import PostDetailContent, { formatData, AuthorAvatar } from "@/components/PostDetailContent";

type AutorType = { nome?: string; titulo?: string; fotoUrl?: string | null };

export default function PostSermaoPage() {
  const { slug } = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const [post, setPost] = useState<any>(null);
  const [postId, setPostId] = useState("");
  const [autor, setAutor] = useState<AutorType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!slug) return;
      try {
        const q = query(collection(db, "posts"), where("slug", "==", slug));
        const snap = await getDocs(q);
        if (snap.empty) { setPost(null); setLoading(false); return; }

        const docSnap = snap.docs[0];
        setPostId(docSnap.id);
        const data = docSnap.data();
        setPost(data);

        if (data.autorId) {
          const autorSnap = await getDoc(doc(db, "users", data.autorId));
          if (autorSnap.exists()) setAutor(autorSnap.data() as AutorType);
        }
      } catch (err) { console.error(err); }
      setLoading(false);
    }
    load();
  }, [slug]);

  if (loading) return <div className="post-detail-loading"><div className="spinner" />Carregando...</div>;
  if (!post) return <div className="post-detail-notfound">Post não encontrado.</div>;

  return (
    <div className="post-detail-wrapper">
      <PostDetailContent post={post} postId={postId} autor={autor} />
    </div>
  );
}