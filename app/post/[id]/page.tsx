"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useParams } from "next/navigation";

type Post = {
  titulo: string;
  autorNome?: string;
  data?: any;
  tipo?: "sermao" | "artigo";
  conteudo: string;
};

export default function PostPage() {
  const params = useParams();
  const id = params?.id as string;

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchPost() {
      if (!id) return;

      setLoading(true);
      setError("");

      try {
        const ref = doc(db, "posts", id);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          setPost(snap.data() as Post);
        } else {
          setError("Post não encontrado.");
        }
      } catch (err) {
        console.error(err);
        setError("Erro ao carregar o post.");
      } finally {
        setLoading(false);
      }
    }

    fetchPost();
  }, [id]);

  if (loading) {
    return <p className="p-4 text-neutral-400">Carregando conteúdo...</p>;
  }

  if (error) {
    return <p className="p-4 text-red-400">{error}</p>;
  }

  if (!post) return null;

  let dataFormatada = "";

  if (post.data?.toDate) {
    const date = post.data.toDate();
    dataFormatada = date.toLocaleDateString("pt-BR");
  }

  return (
    <article className="max-w-2xl mx-auto p-6 space-y-6">

      {/* 📌 CABEÇALHO */}
      <header className="space-y-2">
        <h1 className="text-3xl font-bold leading-tight text-neutral-100">
          {post.titulo}
        </h1>

        <div className="text-sm text-neutral-400 flex gap-2 flex-wrap">
          <span>{post.autorNome || "Autor desconhecido"}</span>
          <span>•</span>
          <span>{dataFormatada}</span>
          <span>•</span>
          <span className="capitalize">
            {post.tipo || "conteúdo"}
          </span>
        </div>
      </header>

      <hr className="border-neutral-700" />

      {/* 📖 CONTEÚDO */}
      <section className="text-lg leading-relaxed whitespace-pre-line text-neutral-200">
        {post.conteudo}
      </section>

    </article>
  );
}