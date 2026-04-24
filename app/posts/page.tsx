"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function Posts() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return <p className="p-4 text-neutral-400">Carregando posts...</p>;
  }

  return (
    <div className="max-w-xl mx-auto p-4 space-y-6">

      {/* TÍTULO */}
      <h1 className="text-2xl font-bold text-neutral-100">
        Conteúdos
      </h1>

      {posts.length === 0 && (
        <p className="text-neutral-400">Nenhum post ainda.</p>
      )}

      {posts.map((post) => (
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
            hover:bg-neutral-800
            hover:border-emerald-600
            hover:shadow-[0_0_10px_rgba(16,185,129,0.15)]
            hover:-translate-y-0.5
          "
        >
          {/* TÍTULO DO POST */}
          <h2 className="text-lg font-semibold text-emerald-300">
            {post.titulo}
          </h2>

          {/* AUTOR + DATA */}
          <p className="text-sm text-neutral-400">
            {post.autorNome || "Autor"} •{" "}
            {post.data?.toDate
              ? post.data.toDate().toLocaleDateString()
              : ""}
          </p>

          {/* TIPO */}
          <p className="text-sm text-emerald-400">
            {post.tipo === "sermao" ? "Sermão" : "Artigo"}
          </p>
        </div>
      ))}

    </div>
  );
}