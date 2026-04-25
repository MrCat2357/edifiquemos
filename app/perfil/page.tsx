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
  writeBatch,
} from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function Perfil() {
  const router = useRouter();

  const [nome, setNome] = useState("");
  const [titulo, setTitulo] = useState("");
  const [bio, setBio] = useState("");

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [compartilharAberto, setCompartilharAberto] = useState<string | null>(null);

  async function carregar() {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const data = snap.data();
        setNome(data.nome || "");
        setTitulo(data.titulo || "");
        setBio(data.bio || "");
      } else {
        setNome(user.displayName || "");
      }

      const q = query(
        collection(db, "posts"),
        where("autorId", "==", user.uid),
        orderBy("data", "desc")
      );

      const snapshot = await getDocs(q);
      const lista: any[] = [];
      snapshot.forEach((doc) => {
        lista.push({ id: doc.id, ...doc.data() });
      });

      setPosts(lista);
    } catch (error) {
      console.error(error);
    }

    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function salvar() {
    const user = auth.currentUser;
    if (!user) return;

    if (!nome.trim()) {
      alert("O nome é obrigatório.");
      return;
    }

    setSalvando(true);

    try {
      const nomeCompleto = titulo.trim()
        ? `${titulo.trim()} ${nome.trim()}`
        : nome.trim();

      await updateDoc(doc(db, "users", user.uid), { nome, titulo, bio });
      await updateProfile(user, { displayName: nome });

      const q = query(collection(db, "posts"), where("autorId", "==", user.uid));
      const snapshot = await getDocs(q);

      const batch = writeBatch(db);
      snapshot.forEach((postDoc) => {
        batch.update(postDoc.ref, { autorNome: nomeCompleto });
      });
      await batch.commit();

      await carregar();
      alert("Perfil atualizado com sucesso!");
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar perfil.");
    }

    setSalvando(false);
  }

  function getUrlPost(post: any) {
    const tipo = post.tipo === "sermao" ? "sermoes" : "artigos";
    return `${window.location.origin}/posts/${tipo}/${post.slug}`;
  }

  if (loading) {
    return <p className="p-4 text-neutral-400">Carregando perfil...</p>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">

      {/* PERFIL */}
      <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-6 space-y-4">
        <h1 className="text-2xl font-bold text-emerald-300">Meu Perfil</h1>

        <input
          className="w-full p-2 rounded bg-neutral-900 border border-neutral-700 text-neutral-100"
          placeholder="Título (ex: Pastor, Presbítero...)"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
        />

        <input
          className="w-full p-2 rounded bg-neutral-900 border border-neutral-700 text-neutral-100"
          placeholder="Seu nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />

        <textarea
          className="w-full p-2 rounded bg-neutral-900 border border-neutral-700 text-neutral-100 h-28"
          placeholder="Descrição do perfil"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />

        <button
          onClick={salvar}
          disabled={salvando}
          className="w-full py-2 rounded text-white bg-emerald-600 hover:bg-emerald-700 transition cursor-pointer active:scale-95 disabled:opacity-50"
        >
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </div>

      {/* POSTS */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-neutral-100">Meus conteúdos</h2>

        {posts.length === 0 && (
          <p className="text-neutral-400">Você ainda não publicou nada.</p>
        )}

        {posts.map((post) => {
          const urlPost = getUrlPost(post);
          const textoCompartilhar = encodeURIComponent(`${post.titulo} - ${post.autorNome}`);
          const urlEncoded = encodeURIComponent(urlPost);

          return (
            <div key={post.id} className="bg-neutral-800 border border-neutral-700 p-4 rounded transition hover:border-emerald-600 hover:shadow-[0_0_10px_rgba(16,185,129,0.15)]">

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
                    <a href={`mailto:?subject=${textoCompartilhar}&body=${urlEncoded}`} className="px-3 py-1 text-xs rounded bg-red-600 hover:bg-red-500 text-white cursor-pointer">
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