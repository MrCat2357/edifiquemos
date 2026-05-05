"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, deleteDoc } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

type User = {
  nome?: string;
  titulo?: string;
};

function formatData(data: any) {
  if (!data) return new Date().toLocaleDateString("pt-BR");
  if (data?.toDate) return data.toDate().toLocaleDateString("pt-BR");
  if (typeof data === "string") return data;
  return new Date(data).toLocaleDateString("pt-BR");
}

function buildFrase(post: any, autorNomeFinal: string) {
  const tipo   = post.tipo;
  const igreja = post.igreja?.trim();
  const data   = formatData(post.data);
  const autor  = autorNomeFinal || "Autor";

  if (tipo === "sermao") {
    if (igreja && post.data) return `Sermão pregado na igreja ${igreja} em ${data}`;
    if (igreja)              return `Sermão pregado na igreja ${igreja}`;
    if (post.data)           return `Sermão pregado em ${data}`;
    return `Sermão publicado em ${data}`;
  }

  return `Artigo publicado por ${autor} em ${data}`;
}

export default function PostPage() {
  const { id }   = useParams();
  const router   = useRouter();
  const { user } = useAuth();

  const [post,    setPost]    = useState<any>(null);
  const [autor,   setAutor]   = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const snap = await getDoc(doc(db, "posts", id as string));
        if (!snap.exists()) { setPost(null); setLoading(false); return; }
        const data = snap.data();
        setPost(data);
        if (data.autorId) {
          const userSnap = await getDoc(doc(db, "users", data.autorId));
          if (userSnap.exists()) setAutor(userSnap.data() as User);
        }
      } catch (err) {
        console.error("Erro ao carregar post:", err);
        setPost(null);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleDelete() {
    if (!confirm("Tem certeza que deseja apagar este post?")) return;
    try {
      await deleteDoc(doc(db, "posts", id as string));
      router.push("/posts");
    } catch (err) {
      console.error("Erro ao apagar post:", err);
      alert("Erro ao apagar o post.");
    }
  }

  if (loading) return <p className="p-4 text-neutral-400">Carregando...</p>;
  if (!post)   return <p className="p-4 text-red-400">Post não encontrado</p>;

  const nomeExibicao =
    autor?.titulo && autor?.nome
      ? `${autor.titulo} ${autor.nome}`
      : autor?.nome || post.autorNome || "Autor";

  const isAutor = user?.uid === post.autorId;

  return (
    <article className="max-w-2xl mx-auto p-6 space-y-6">

      {/* TOPO: badge de tipo + botões de autor */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
        <span
          className={`cat-badge ${post.tipo === "sermao" ? "cat-sermao" : "cat-artigo"}`}
        >
          {post.tipo === "sermao" ? "Sermão" : "Artigo"}
        </span>

        {isAutor && (
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => router.push(`/editar/${id}`)}
              className="post-btn-edit"
            >
              Editar
            </button>
            <button
              onClick={handleDelete}
              className="post-btn-delete"
            >
              Apagar
            </button>
          </div>
        )}
      </div>

      {/* TÍTULO */}
      <h1
        style={{
          fontSize: "clamp(1.5rem, 5vw, 2.25rem)",
          fontWeight: 800,
          color: "var(--text-1)",
          lineHeight: 1.15,
          letterSpacing: "-0.02em",
        }}
      >
        {post.titulo}
      </h1>

      {/* META: autor + data */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          flexWrap: "wrap",
          fontSize: "0.85rem",
          color: "var(--text-3)",
        }}
      >
        <span
          style={{ color: "var(--emerald)", fontWeight: 600, cursor: "pointer" }}
          onClick={() => { if (post.autorId) router.push(`/perfil/${post.autorId}`); }}
        >
          {nomeExibicao}
        </span>
        <span>·</span>
        <span>{formatData(post.data)}</span>
      </div>

      {/* IMAGEM DE CAPA (quando existir) */}
      {post.imagemUrl && (
        <div
          style={{
            width: "100%",
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
            border: "1px solid var(--border)",
          }}
        >
          <img
            src={post.imagemUrl}
            alt={`Imagem de capa: ${post.titulo}`}
            style={{
              width: "100%",
              aspectRatio: "16 / 7",
              objectFit: "cover",
              display: "block",
            }}
          />
        </div>
      )}

      {/* CONTEÚDO */}
      <div
        style={{
          color: "var(--text-2)",
          lineHeight: 1.85,
          whiteSpace: "pre-line",
          fontSize: "0.975rem",
        }}
      >
        {post.conteudo}
      </div>

      <hr style={{ borderColor: "var(--border)", margin: "1.5rem 0" }} />

      <p
        style={{
          textAlign: "center",
          fontSize: "0.82rem",
          color: "var(--emerald)",
          fontStyle: "italic",
          opacity: 0.8,
        }}
      >
        {buildFrase(post, nomeExibicao)}
      </p>
    </article>
  );
}