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
  igreja?: string;
};

export default function PostPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchPost() {
      try {
        const ref = doc(db, "posts", id);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          setPost(snap.data() as Post);
        } else {
          setError("Post não encontrado.");
        }
      } catch {
        setError("Erro ao carregar o post.");
      } finally {
        setLoading(false);
      }
    }

    fetchPost();
  }, [id]);

  async function handleDelete() {
    if (!confirm("Tem certeza que deseja apagar este post?")) return;

    await deleteDoc(doc(db, "posts", id));
    router.push("/posts");
  }

  if (loading) return <p className="p-4 text-neutral-400">Carregando...</p>;
  if (error) return <p className="p-4 text-red-400">{error}</p>;
  if (!post) return null;

  const isOwner = auth.currentUser?.uid === post.autorId;

  let dataFormatada = "";
  if (post.data?.toDate) {
    dataFormatada = post.data.toDate().toLocaleDateString("pt-BR");
  }

  // ✨ FRASE FINAL
  let fraseFinal = "";

  if (post.tipo === "sermao") {
    if (post.igreja || dataFormatada) {
      fraseFinal = `Sermão pregado ${
        post.igreja ? `na igreja ${post.igreja}` : ""
      } ${dataFormatada ? `em ${dataFormatada}` : ""}.`;
    }
  } else {
    fraseFinal = `Artigo publicado por ${post.autorNome || "autor"} ${
      post.igreja ? `da igreja ${post.igreja}` : ""
    } ${dataFormatada ? `em ${dataFormatada}` : ""}.`;
  }

  return (
    <article className="max-w-2xl mx-auto p-6 space-y-6">

      <header>
        <h1 className="text-3xl font-bold text-neutral-100">
          {post.titulo}
        </h1>

        <p className="text-sm text-neutral-400">
          {post.autorNome} • {dataFormatada}
        </p>
      </header>

      <hr className="border-neutral-700" />

      <section className="text-lg text-neutral-200 whitespace-pre-line">
        {post.conteudo}
      </section>

      {/* ✨ FRASE FINAL */}
      {fraseFinal && (
        <p className="text-sm text-neutral-400 italic pt-4">
          {fraseFinal}
        </p>
      )}

      {isOwner && (
        <div className="flex gap-3 pt-4">
          <button
            onClick={() => router.push(`/editar/${id}`)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded"
          >
            Editar
          </button>

          <button
            onClick={handleDelete}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
          >
            Apagar
          </button>
        </div>
      )}
    </article>
  );
}