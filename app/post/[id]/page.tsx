"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";

function formatData(data: any) {
  if (!data) return new Date().toLocaleDateString("pt-BR");

  if (data?.toDate) {
    return data.toDate().toLocaleDateString("pt-BR");
  }

  if (typeof data === "string") {
    return data;
  }

  return new Date().toLocaleDateString("pt-BR");
}

function buildFrase(post: any) {
  const tipo = post.tipo;
  const igreja = post.igreja?.trim();
  const data = formatData(post.data);
  const autor = post.autorNome || "Autor";

  if (tipo === "sermao") {
    if (igreja && post.data) {
      return `Sermão pregado na igreja ${igreja} em ${data}`;
    }

    if (igreja) {
      return `Sermão pregado na igreja ${igreja}`;
    }

    if (post.data) {
      return `Sermão pregado em ${data}`;
    }

    return `Sermão publicado em ${data}`;
  }

  return `Artigo publicado por ${autor} em ${data}`;
}

export default function PostPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPost() {
      if (!id) return;

      try {
        const ref = doc(db, "posts", id);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          setPost({ id: snap.id, ...snap.data() });
        }
      } catch (err) {
        console.error(err);
      }

      setLoading(false);
    }

    fetchPost();
  }, [id]);

  if (loading) {
    return <p className="p-4 text-neutral-400">Carregando post...</p>;
  }

  if (!post) {
    return <p className="p-4 text-red-400">Post não encontrado.</p>;
  }

  const isOwner = auth.currentUser?.uid === post.autorId;

  return (
    <article className="max-w-2xl mx-auto p-6 space-y-6">

      {/* TÍTULO */}
      <h1 className="text-3xl font-bold text-neutral-100">
        {post.titulo}
      </h1>

      {/* META */}
      <div className="text-sm text-neutral-400">
        <span
          className="hover:underline cursor-pointer"
          onClick={() => router.push(`/perfil/${post.autorId}`)}
        >
          {post.autorNome || "Autor"}
        </span>
        {" • "}
        {formatData(post.data)}
        {" • "}
        <span className="text-emerald-400">
          {post.tipo === "sermao" ? "Sermão" : "Artigo"}
        </span>
      </div>

      {/* FRASE DINÂMICA */}
      <p className="text-neutral-300 italic">
        {buildFrase(post)}
      </p>

      <hr className="border-neutral-700" />

      {/* CONTEÚDO */}
      <div className="text-neutral-200 leading-relaxed whitespace-pre-line">
        {post.conteudo}
      </div>

      {/* AÇÕES DONO */}
      {isOwner && (
        <div className="flex gap-3 pt-4">

          <button
            onClick={() => router.push(`/editar/${id}`)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded cursor-pointer"
          >
            Editar
          </button>

          <button
            onClick={() => alert("implementar delete")}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded cursor-pointer"
          >
            Apagar
          </button>

        </div>
      )}

    </article>
  );
}