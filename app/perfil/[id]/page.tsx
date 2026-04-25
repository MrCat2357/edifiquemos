"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
} from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";

type User = {
  nome?: string;
  titulo?: string;
  bio?: string;
};

export default function PerfilPublico() {
  const { id } = useParams();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregar() {
      if (!id) return;

      try {
        // 👤 USUÁRIO
        const userRef = doc(db, "users", id as string);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          setUser(userSnap.data() as User);
        }

        // 📝 POSTS
        const q = query(
          collection(db, "posts"),
          where("autorId", "==", id),
          orderBy("data", "desc")
        );

        const snap = await getDocs(q);

        const lista: any[] = [];

        snap.forEach((doc) => {
          lista.push({
            id: doc.id,
            ...doc.data(),
          });
        });

        setPosts(lista);
      } catch (err) {
        console.error(err);
      }

      setLoading(false);
    }

    carregar();
  }, [id]);

  if (loading) {
    return <p className="p-4 text-neutral-400">Carregando perfil...</p>;
  }

  if (!user) {
    return <p className="p-4 text-red-400">Usuário não encontrado.</p>;
  }

  const nomeExibicao =
    user.titulo && user.nome
      ? `${user.titulo} ${user.nome}`
      : user.nome || "Usuário";

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">

      {/* HEADER PERFIL */}
      <div className="bg-neutral-800 border border-neutral-700 p-6 rounded space-y-3">

        <h1 className="text-2xl font-bold text-emerald-300">
          {nomeExibicao}
        </h1>

        {user.bio && (
          <p className="text-neutral-300 leading-relaxed">
            {user.bio}
          </p>
        )}

        {!user.bio && (
          <p className="text-neutral-500 text-sm">
            Sem descrição.
          </p>
        )}
      </div>

      {/* POSTS */}
      <div className="space-y-4">

        <h2 className="text-xl font-semibold text-neutral-100">
          Publicações
        </h2>

        {posts.length === 0 && (
          <p className="text-neutral-400">
            Nenhuma publicação ainda.
          </p>
        )}

        {posts.map((post) => (
          <div
            key={post.id}
            onClick={() => router.push(`/post/${post.id}`)}
            className="
              bg-neutral-800 border border-neutral-700
              p-4 rounded cursor-pointer
              hover:border-emerald-600
              hover:shadow-[0_0_10px_rgba(16,185,129,0.15)]
            "
          >
            <h3 className="text-lg font-semibold text-emerald-300">
              {post.titulo}
            </h3>

            <p className="text-sm text-neutral-400 mt-1">
              {post.data?.toDate
                ? post.data.toDate().toLocaleDateString("pt-BR")
                : ""}
            </p>

            <p className="text-sm text-emerald-400 mt-1">
              {post.tipo === "sermao" ? "Sermão" : "Artigo"}
            </p>
          </div>
        ))}

      </div>
    </div>
  );
}