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

  if (loading) return (
    <div className="post-detail-loading">
      <div className="spinner" />
      Carregando...
    </div>
  );

  if (!post) return (
    <div className="post-detail-notfound">
      Post não encontrado.
    </div>
  );

  const nomeExibicao =
    autor?.titulo && autor?.nome
      ? `${autor.titulo} ${autor.nome}`
      : autor?.nome || post.autorNome || "Autor";

  const isAutor = user?.uid === post.autorId;

  const urlAtual = typeof window !== "undefined" ? window.location.href : "";
  const textoCompartilhar = encodeURIComponent(`${post.titulo} - ${nomeExibicao}`);
  const urlEncoded = encodeURIComponent(urlAtual);

  return (
    <div className="post-detail-wrapper">
      <article className="post-detail-card">

        {/* TOPO: tipo do post */}
        <div className="post-detail-top">
          <span className="cat-badge cat-artigo">Artigo</span>
          {isAutor && (
            <div className="post-detail-owner-btns">
              <button onClick={() => router.push(`/editar/${postId}`)} className="post-btn-edit">
                Editar
              </button>
              <button onClick={handleDelete} className="post-btn-delete">
                Apagar
              </button>
            </div>
          )}
        </div>

        {/* TÍTULO */}
        <h1 className="post-detail-title">{post.titulo}</h1>

        {/* META: autor, data */}
        <div className="post-detail-meta">
          <span
            className="post-detail-autor"
            onClick={() => { if (post.autorId) router.push(`/perfil/${post.autorId}`); }}
          >
            {nomeExibicao}
          </span>
          <span className="post-detail-sep">·</span>
          <span>{formatData(post.data)}</span>
        </div>

        {/* DIVISOR */}
        <hr className="post-detail-divider" />

        {/* CONTEÚDO */}
        <div className="post-detail-content">
          {post.conteudo}
        </div>

        {/* RODAPÉ DO ARTIGO */}
        <p className="post-detail-footer-text">
          Artigo publicado por {nomeExibicao} em {formatData(post.data)}
        </p>

        {/* DIVISOR */}
        <hr className="post-detail-divider" />

        {/* COMPARTILHAR */}
        <div className="post-detail-share">
          <button
            onClick={() => setCompartilharAberto(!compartilharAberto)}
            className="post-btn-share"
          >
            🔗 Compartilhar
          </button>

          {compartilharAberto && (
            <div className="post-share-options">
              <a href={`https://wa.me/?text=${textoCompartilhar}%20${urlEncoded}`} target="_blank" rel="noopener noreferrer" className="share-btn share-whatsapp">
                WhatsApp
              </a>
              <a href={`https://www.facebook.com/sharer/sharer.php?u=${urlEncoded}`} target="_blank" rel="noopener noreferrer" className="share-btn share-facebook">
                Facebook
              </a>
              <a href={`https://www.threads.net/intent/post?text=${textoCompartilhar}%20${urlEncoded}`} target="_blank" rel="noopener noreferrer" className="share-btn share-threads">
                Threads
              </a>
              <a href={`https://twitter.com/intent/tweet?text=${textoCompartilhar}&url=${urlEncoded}`} target="_blank" rel="noopener noreferrer" className="share-btn share-twitter">
                X (Twitter)
              </a>
              <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${urlEncoded}`} target="_blank" rel="noopener noreferrer" className="share-btn share-linkedin">
                LinkedIn
              </a>
              <a href={`mailto:?subject=${textoCompartilhar}&body=${encodeURIComponent(post.conteudo + "\n\n" + urlAtual)}`} className="share-btn share-email">
                Email
              </a>
              <button onClick={copiarLink} className="share-btn share-copy">
                {copiado ? "✓ Copiado!" : "Copiar link"}
              </button>
            </div>
          )}
        </div>

      </article>
    </div>
  );
}
