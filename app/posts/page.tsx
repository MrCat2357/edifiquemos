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
    return <p className="p-4">Carregando posts...</p>;
  }

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">Posts</h1>

      {posts.length === 0 && <p>Nenhum post ainda.</p>}

      {posts.map((post) => (
        <div
          key={post.id}
          onClick={() => router.push(`/post/${post.id}`)}
          className="border p-4 rounded hover:shadow cursor-pointer"
        >
          <h2 className="text-lg font-semibold">{post.titulo}</h2>

          <p className="text-sm text-gray-500">
            {post.autorNome || "Autor"} •{" "}
            {post.data?.toDate
              ? post.data.toDate().toLocaleDateString()
              : ""}
          </p>

          <p className="text-sm mt-2 text-gray-600">
            {post.tipo === "sermao" ? "Sermão" : "Artigo"}
          </p>
        </div>
      ))}
    </div>
  );
}