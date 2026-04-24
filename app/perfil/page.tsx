"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { updateProfile } from "firebase/auth";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
} from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function Perfil() {
  const router = useRouter();

  const [nome, setNome] = useState("");
  const [titulo, setTitulo] = useState("");
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [posts, setPosts] = useState<any[]>([]);

  // 📥 Carregar dados do usuário + posts
  useEffect(() => {
    async function carregar() {
      const user = auth.currentUser;
      if (!user) return;

      try {
        // 🔹 dados do perfil
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const data = snap.data();
          setNome(data.nome || "");
          setTitulo(data.titulo || "");
        } else {
          setNome(user.displayName || "");
        }

        // 🔹 posts do usuário
        const q = query(
          collection(db, "posts"),
          where("autorId", "==", user.uid),
          orderBy("data", "desc")
        );

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
        console.error(error);
      }

      setLoading(false);
    }

    carregar();
  }, []);

  // 💾 salvar perfil
  async function salvar() {
    const user = auth.currentUser;
    if (!user) return;

    if (!nome.trim()) {
      alert("O nome é obrigatório.");
      return;
    }

    setSalvando(true);

    try {
      await updateDoc(doc(db, "users", user.uid), {
        nome,
        titulo,
      });

      await updateProfile(user, {
        displayName: nome,
      });

      alert("Perfil atualizado com sucesso!");
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar perfil.");
    }

    setSalvando(false);
  }

  if (loading) {
    return <p className="p-4 text-neutral-400">Carregando perfil...</p>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">

      {/* 🧑 PERFIL */}
      <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-6 space-y-4">

        <h1 className="text-2xl font-bold text-emerald-300">
          Meu Perfil
        </h1>

        {/* TÍTULO */}
        <input
          className="w-full p-2 rounded bg-neutral-900 border border-neutral-700 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
          placeholder="Título (ex: Pastor, Presbítero...)"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
        />

        {/* NOME */}
        <input
          className="w-full p-2 rounded bg-neutral-900 border border-neutral-700 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
          placeholder="Seu nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />

        {/* BOTÃO */}
        <button
          onClick={salvar}
          disabled={salvando}
          className="
            w-full py-2 rounded text-white
            bg-emerald-600 hover:bg-emerald-700
            active:scale-95 active:translate-y-0.5
            transition shadow-md
            disabled:opacity-50
            cursor-pointer
          "
        >
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </div>

      {/* 📝 POSTS DO USUÁRIO */}
      <div className="space-y-4">

        <h2 className="text-xl font-semibold text-neutral-100">
          Meus conteúdos
        </h2>

        {posts.length === 0 && (
          <p className="text-neutral-400">
            Você ainda não publicou nada.
          </p>
        )}

        {posts.map((post) => (
          <div
            key={post.id}
            onClick={() => router.push(`/post/${post.id}`)}
            className="
              bg-neutral-800
              border border-neutral-700
              p-4 rounded
              cursor-pointer
              transition
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