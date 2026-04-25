"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, deleteDoc, doc } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

type AutorType = { nome?: string; titulo?: string };

function formatData(data: any) {
  if (!data) return new Date().toLocaleDateString("pt-BR");
  if (data?.toDate) return data.toDate().toLocaleDateString("pt-BR");
  if (typeof data === "string") return data;
  return new Date(data).toLocaleDateString("pt-BR");
}

export default function PostArtigoPage() {
  const { slug } = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const [post, setPost] = useState<any>(null);
  const [postId, setPostId] = useState<string>("");
  const [autor, setAutor] = useState<AutorType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!slug) return;
      try {
        const q = query(collection(db, "posts"), where("slug", "==", slug));
        const snap = await getDocs(q);

        if (snap.empty) {
          setPost(null);
          setLoading(false);
          return;
        }

        const docSnap = snap.docs[0];
        setPostId(docSnap.id);
        const data = docSnap.data();
        setPost(data);

        if (data.autorId) {
          const userQ = query(collection(db, "users"), where("__name__", "==", data.autorId));
          const userSnap = await getDocs(userQ);
          if (!userSnap.empty) setAutor(userSnap.docs[0].data() as AutorType);
        }
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    }
    load();
  }, [slug]);

  async function handleDelete() {
    if (!confirm("Tem certeza que deseja apagar este post?")) return;
    try {
      await deleteDoc(doc(db, "posts", postId));
      router.push("/posts");
    } catch (err) {
      console.error(err);
      alert("Erro ao apagar o post.");
    }
  }

  if (loading) return <p className="p-4 text-neutral-400">Carregando...</p>;
  if (!post) return <p className="p-4 text-red-400">Post não encontrado</p>;

  const nomeExibicao =
    autor?.titulo && autor?.nome
      ? `${autor.titulo} ${autor.nome}`
      : autor?.nome || post.autorNome || "Autor";

  const isAutor = user?.uid === post.autorId;

  return (
    <article className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold text-neutral-100">{post.titulo}</h1>

      <div className="text-sm text-neutral-400 flex gap-2 flex-wrap">
        <span
          className="text-emerald-400 hover:underline cursor-pointer"
          onClick={() => { if (post.autorId) router.push(`/perfil/${post.autorId}`); }}
        >
          {nomeExibicao}
        </span>
        <span>•</span>
        <span>{formatData(post.data)}</span>
        <span>•</span>
        <span className="text-emerald-400 capitalize">{post.tipo}</span>
      </div>

      <div className="text-neutral-200 leading-relaxed whitespace-pre-line">
        {post.conteudo}
      </div>

      <hr className="border-neutral-700 my-6" />

      <p className="text-center text-sm text-emerald-400 italic opacity-80">
        Artigo publicado por {nomeExibicao} em {formatData(post.data)}
      </p>

      {isAutor && (
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => router.push(`/editar/${postId}`)}
            className="px-3 py-1 text-sm rounded bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
          >
            Editar
          </button>
          <button
            onClick={handleDelete}
            className="px-3 py-1 text-sm rounded bg-red-600 hover:bg-red-500 text-white cursor-pointer"
          >
            Apagar
          </button>
        </div>
      )}
    </article>
  );
}