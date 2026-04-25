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
  const [copiado, setCopiado] = useState(false);
  const [compartilharAberto, setCompartilharAberto] = useState(false);

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

  async function copiarLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  if (loading) return <p className="p-4 text-neutral-400">Carregando...</p>;
  if (!post) return <p className="p-4 text-red-400">Post não encontrado</p>;

  const nomeExibicao =
    autor?.titulo && autor?.nome
      ? `${autor.titulo} ${autor.nome}`
      : autor?.nome || post.autorNome || "Autor";

  const isAutor = user?.uid === post.autorId;

  const urlAtual = typeof window !== "undefined" ? window.location.href : "";
  const textoCompartilhar = encodeURIComponent(`${post.titulo} - ${nomeExibicao}`);
  const urlEncoded = encodeURIComponent(urlAtual);

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

      {/* COMPARTILHAR */}
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={() => setCompartilharAberto(!compartilharAberto)}
          className="px-4 py-2 text-sm rounded bg-white hover:bg-neutral-200 text-neutral-900 cursor-pointer transition font-semibold"
        >
          Compartilhar
        </button>

        {compartilharAberto && (
          <div className="flex flex-wrap gap-2 justify-center">
            <a href={`https://wa.me/?text=${textoCompartilhar}%20${urlEncoded}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1 text-sm rounded bg-green-600 hover:bg-green-500 text-white cursor-pointer">
              WhatsApp
            </a>
            <a href={`https://www.facebook.com/sharer/sharer.php?u=${urlEncoded}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1 text-sm rounded bg-blue-600 hover:bg-blue-500 text-white cursor-pointer">
              Facebook
            </a>
            <a href={`https://www.threads.net/intent/post?text=${textoCompartilhar}%20${urlEncoded}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1 text-sm rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-white cursor-pointer">
              Threads
            </a>
            <a href={`https://twitter.com/intent/tweet?text=${textoCompartilhar}&url=${urlEncoded}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1 text-sm rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-600 text-white cursor-pointer">
              X (Twitter)
            </a>
            <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${urlEncoded}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1 text-sm rounded bg-blue-700 hover:bg-blue-600 text-white cursor-pointer">
              LinkedIn
            </a>
            <a href={`mailto:?subject=${textoCompartilhar}&body=${urlEncoded}`} className="px-3 py-1 text-sm rounded bg-neutral-500 hover:bg-neutral-400 text-white cursor-pointer">
              Email
            </a>
            <button onClick={copiarLink} className="px-3 py-1 text-sm rounded bg-neutral-600 hover:bg-neutral-500 text-white cursor-pointer">
              {copiado ? "Link copiado!" : "Copiar link"}
            </button>
          </div>
        )}
      </div>

      {/* BOTÕES EDITAR/APAGAR */}
      {isAutor && (
        <div className="flex gap-2 justify-end">
          <button onClick={() => router.push(`/editar/${postId}`)} className="px-3 py-1 text-sm rounded bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer">
            Editar
          </button>
          <button onClick={handleDelete} className="px-3 py-1 text-sm rounded bg-red-600 hover:bg-red-500 text-white cursor-pointer">
            Apagar
          </button>
        </div>
      )}
    </article>
  );
}