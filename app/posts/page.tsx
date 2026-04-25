"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { useRouter } from "next/navigation";

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

  // 📖 SERMÃO
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

  // ✍️ ARTIGO
  return `Artigo publicado por ${autor} em ${data}`;
}

export default function Posts() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [filtro, setFiltro] = useState<"todos" | "sermao" | "artigo">("todos");

  const router = useRouter();

  useEffect(() => {
    async function fetchPosts() {
      try {
        const q = query(collection(db, "posts"), orderBy("data", "desc"));
        const snapshot = await getDocs(q);

        const lista: any[] = [];

        snapshot.forEach((doc) => {
          lista.push({
            id: doc.id,
            ...doc.data(),
          });
        });

        setPosts(lista);
      } catch (error) {
        console.error("Erro ao buscar posts:", error);
      }

      setLoading(false);
    }

    fetchPosts();
  }, []);

  const postsFiltrados =
    filtro === "todos"
      ? posts
      : posts.filter((p) => p.tipo === filtro);

  if (loading) {
    return <p className="p-4 text-neutral-400">Carregando posts...</p>;
  }

  return (
    <div className="max-w-xl mx-auto p-4 space-y-6">

      <h1 className="text-2xl font-bold text-neutral-100">
        Conteúdos
      </h1>

      {/* 🔎 FILTRO */}
      <div className="flex gap-2">
        {["todos", "sermao", "artigo"].map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f as any)}
            className={`
              px-3 py-1 rounded text-sm capitalize cursor-pointer transition
              ${
                filtro === f
                  ? "bg-emerald-600 text-white"
                  : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              }
            `}
          >
            {f === "todos" ? "Todos" : f}
          </button>
        ))}
      </div>

      {postsFiltrados.length === 0 && (
        <p className="text-neutral-400">Nenhum post encontrado.</p>
      )}

      {postsFiltrados.map((post) => (
        <div
          key={post.id}
          onClick={() => router.push(`/post/${post.id}`)}
          className="
            bg-neutral-800
            border border-neutral-700
            p-5
            rounded
            cursor-pointer
            transition
            space-y-2
            hover:border-emerald-600
            hover:shadow-[0_0_10px_rgba(16,185,129,0.15)]
            hover:-translate-y-0.5
          "
        >
          <h2 className="text-lg font-semibold text-emerald-300">
            {post.titulo}
          </h2>

          <p className="text-sm text-neutral-400">
            {buildFrase(post)}
          </p>

          <p className="text-sm text-emerald-400">
            {post.tipo === "sermao" ? "Sermão" : "Artigo"}
          </p>
        </div>
      ))}
    </div>
  );
}