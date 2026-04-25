"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc, deleteDoc } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";

type Post = {
  titulo: string;
  autorNome?: string;
  autorId?: string;
  data?: any;
  tipo?: "sermao" | "artigo";
  conteudo: string;
};

type Autor = {
  nome?: string;
  titulo?: string;
};

export default function PostPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [post, setPost] = useState<Post | null>(null);
  const [autor, setAutor] = useState<Autor | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchPost() {
      if (!id) return;

      try {
        const ref = doc(db, "posts", id);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setError("Post não encontrado.");
          setLoading(false);
          return;
        }

        const data = snap.data() as Post;
        setPost(data);

        // 🔥 BUSCAR AUTOR REAL (corrige "Usuário")
        if (data.autorId) {
          const userRef = doc(db, "users", data.autorId);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            setAutor(userSnap.data() as Autor);
          }
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

  async function handleDelete() {
    if (!confirm("Tem certeza que deseja apagar este post?")) return;

    try {
      await deleteDoc(doc(db, "posts", id));
      router.push("/posts");
    } catch (err) {
      console.error(err);
      alert("Erro ao apagar post.");
    }
  }

  if (loading) {
    return <p className="p-4 text-neutral-400">Carregando conteúdo...</p>;
  }

  if (error || !post) {
    return <p className="p-4 text-red-400">{error}</p>;
  }

  const isOwner = auth.currentUser?.uid === post.autorId;

  let dataFormatada = "";
  if (post.data?.toDate) {
    dataFormatada = post.data.toDate().toLocaleDateString("pt-BR");
  }

  const nomeExibicao =
    autor?.titulo && autor?.nome
      ? `${autor.titulo} ${autor.nome}`
      : autor?.nome || post.autorNome || "Autor desconhecido";

  return (
    <article className="max-w-2xl mx-auto p-6 space-y-6">

      {/* HEADER */}
      <header className="space-y-2">

        <h1 className="text-3xl font-bold text-neutral-100">
          {post.titulo}
        </h1>

        <div className="text-sm text-neutral-400 flex gap-2 flex-wrap items-center">

          {/* 👤 AUTOR CLICÁVEL */}
          <button
            onClick={() => router.push(`/perfil/${post.autorId}`)}
            className="hover:underline cursor-pointer text-emerald-400"
          >
            {nomeExibicao}
          </button>

          <span>•</span>

          <span>{dataFormatada}</span>

          <span>•</span>

          <span className="capitalize">
            {post.tipo || "conteúdo"}
          </span>
        </div>
      </header>

      <hr className="border-neutral-700" />

      {/* CONTEÚDO */}
      <section className="text-lg leading-relaxed whitespace-pre-line text-neutral-200">
        {post.conteudo}
      </section>

      {/* BOTÕES DONO */}
      {isOwner && (
        <div className="flex gap-3 pt-4">

          <button
            onClick={() => router.push(`/editar/${id}`)}
            className="
              px-4 py-2
              bg-emerald-600 hover:bg-emerald-700
              text-white rounded
              cursor-pointer
              transition
              active:scale-95
            "
          >
            Editar
          </button>

          <button
            onClick={handleDelete}
            className="
              px-4 py-2
              bg-red-600 hover:bg-red-700
              text-white rounded
              cursor-pointer
              transition
              active:scale-95
            "
          >
            Apagar
          </button>

        </div>
      )}

    </article>
  );
}