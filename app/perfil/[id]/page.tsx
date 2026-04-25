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
  const [copiado, setCopiado] = useState<string | null>(null);
  const [compartilharAberto, setCompartilharAberto] = useState<string | null>(null);

  useEffect(() => {
    async function carregar() {
      if (!id) return;

      try {
        const userRef = doc(db, "users", id as string);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          setUser(userSnap.data() as User);
        }

        const q = query(
          collection(db, "posts"),
          where("autorId", "==", id),
          orderBy("data", "desc")
        );

        const snap = await getDocs(q);
        const lista: any[] = [];
        snap.forEach((doc) => {
          lista.push({ id: doc.id, ...doc.data() });
        });

        setPosts(lista);
      } catch (err) {
        console.error(err);
      }

      setLoading(false);
    }

    carregar();
  }, [id]);

  if (loading) return <p className="p-4 text-neutral-400">Carregando perfil...</p>;
  if (!user) return <p className="p-4 text-red-400">Usuário não encontrado.</p>;

  const nomeExibicao =
    user.titulo && user.nome
      ? `${user.titulo} ${user.nome}`
      : user.nome || "Usuário";

  function getUrlPost(post: any) {
    const tipo = post.tipo === "sermao" ? "sermoes" : "artigos";
    return `${window.location.origin}/posts/${tipo}/${post.slug}`;
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">

      <div className="bg-neutral-800 border border-neutral-700 p-6 rounded space-y-3">
        <h1 className="text-2xl font-bold text-emerald-300">{nomeExibicao}</h1>
        {user.bio ? (
          <p className="text-neutral-300 leading-relaxed">{user.bio}</p>
        ) : (
          <p className="text-neutral-500 text-sm">Sem descrição.</p>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-neutral-100">Publicações</h2>

        {posts.length === 0 && (
          <p className="text-neutral-400">Nenhuma publicação ainda.</p>
        )}

        {posts.map((post) => {
          const urlPost = getUrlPost(post);
          const textoCompartilhar = encodeURIComponent(`${post.titulo} - ${post.autorNome}`);
          const urlEncoded = encodeURIComponent(urlPost);

          return (
            <div key={post.id} className="bg-neutral-800 border border-neutral-700 p-4 rounded hover:border-emerald-600 hover:shadow-[0_0_10px_rgba(16,185,129,0.15)]">

              <div
                onClick={() => router.push(`/posts/${post.tipo === "sermao" ? "sermoes" : "artigos"}/${post.slug}`)}
                className="cursor-pointer"
              >
                <h3 className="text-lg font-semibold text-emerald-300">{post.titulo}</h3>
                <p className="text-sm text-neutral-400 mt-1">
                  {post.data?.toDate ? post.data.toDate().toLocaleDateString("pt-BR") : ""}
                </p>
                <p className="text-sm text-emerald-400 mt-1">
                  {post.tipo === "sermao" ? "Sermão" : "Artigo"}
                </p>
              </div>

              <div className="mt-3 flex flex-col gap-2">
                <button
                  onClick={() => setCompartilharAberto(compartilharAberto === post.id ? null : post.id)}
                  className="px-3 py-1 text-xs rounded bg-white hover:bg-neutral-200 text-neutral-900 cursor-pointer transition font-semibold w-fit"
                >
                  Compartilhar
                </button>

                {compartilharAberto === post.id && (
                  <div className="flex flex-wrap gap-2">
                    <a href={`https://wa.me/?text=${textoCompartilhar}%20${urlEncoded}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1 text-xs rounded bg-green-600 hover:bg-green-500 text-white cursor-pointer">
                      WhatsApp
                    </a>
                    <a href={`https://www.facebook.com/sharer/sharer.php?u=${urlEncoded}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white cursor-pointer">
                      Facebook
                    </a>
                    <a href={`https://www.threads.net/intent/post?text=${textoCompartilhar}%20${urlEncoded}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1 text-xs rounded bg-neutral-700 hover:bg-neutral-600 border border-neutral-600 text-white cursor-pointer">
                      Threads
                    </a>
                    <a href={`https://twitter.com/intent/tweet?text=${textoCompartilhar}&url=${urlEncoded}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1 text-xs rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-600 text-white cursor-pointer">
                      X (Twitter)
                    </a>
                    <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${urlEncoded}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1 text-xs rounded bg-blue-700 hover:bg-blue-600 text-white cursor-pointer">
                      LinkedIn
                    </a>
                    <a href={`mailto:?subject=${encodeURIComponent(post.titulo)}&body=${encodeURIComponent(post.conteudo + "\n\n" + urlPost)}`} className="px-3 py-1 text-xs rounded bg-red-600 hover:bg-red-500 text-white cursor-pointer">
  Email
</a>
                    <button
                      onClick={() => { navigator.clipboard.writeText(urlPost); setCopiado(post.id); setTimeout(() => setCopiado(null), 2000); }}
                      className="px-3 py-1 text-xs rounded bg-neutral-600 hover:bg-neutral-500 text-white cursor-pointer"
                    >
                      {copiado === post.id ? "Copiado!" : "Copiar link"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}