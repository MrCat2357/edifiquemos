"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";

type User = {
  nome?: string;
  titulo?: string;
};

function formatData(data: any) {
  if (!data) return new Date().toLocaleDateString("pt-BR");

  if (data?.toDate) {
    return data.toDate().toLocaleDateString("pt-BR");
  }

  if (typeof data === "string") {
    return data;
  }

  return new Date(data).toLocaleDateString("pt-BR");
}

function buildFrase(post: any, autorNomeFinal: string) {
  const tipo = post.tipo;
  const igreja = post.igreja?.trim();
  const data = formatData(post.data);
  const autor = autorNomeFinal || "Autor";

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
  const { id } = useParams();
  const router = useRouter();

  const [post, setPost] = useState<any>(null);
  const [autor, setAutor] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!id) return;

      try {
        const postRef = doc(db, "posts", id as string);
        const snap = await getDoc(postRef);

        if (!snap.exists()) {
          setPost(null);
          setLoading(false);
          return;
        }

        const data = snap.data();
        setPost(data);

        // 🔥 AUTOR SEMPRE ATUALIZADO
        if (data.autorId) {
          const userRef = doc(db, "users", data.autorId);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            setAutor(userSnap.data() as User);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar post:", err);
        setPost(null);
      }

      setLoading(false);
    }

    load();
  }, [id]);

  if (loading) {
    return <p className="p-4 text-neutral-400">Carregando...</p>;
  }

  if (!post) {
    return <p className="p-4 text-red-400">Post não encontrado</p>;
  }

  // 🔥 NOME FINAL SEM BUG
  const nomeExibicao =
    autor?.titulo && autor?.nome
      ? `${autor.titulo} ${autor.nome}`
      : autor?.nome || post.autorNome || "Autor";

  return (
    <article className="max-w-2xl mx-auto p-6 space-y-6">

      {/* TÍTULO */}
      <h1 className="text-3xl font-bold text-neutral-100">
        {post.titulo}
      </h1>

      {/* META */}
      <div className="text-sm text-neutral-400 flex gap-2 flex-wrap">

        {/* AUTOR CLICÁVEL */}
        <span
          className="text-emerald-400 hover:underline cursor-pointer"
          onClick={() => {
            if (post.autorId) {
              router.push(`/perfil/${post.autorId}`);
            }
          }}
        >
          {nomeExibicao}
        </span>

        <span>•</span>

        {/* DATA */}
        <span>{formatData(post.data)}</span>

        <span>•</span>

        {/* TIPO */}
        <span className="text-emerald-400 capitalize">
          {post.tipo}
        </span>
      </div>

      {/* CONTEÚDO */}
      <div className="text-neutral-200 leading-relaxed whitespace-pre-line">
        {post.conteudo}
      </div>

      {/* SEPARADOR */}
      <hr className="border-neutral-700 my-6" />

      {/* FRASE FINAL (ENCERRAMENTO DE LEITURA) */}
      <p className="text-center text-sm text-emerald-400 italic opacity-80">
        {buildFrase(post, nomeExibicao)}
      </p>

    </article>
  );
}