"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";

function formatData(data: any) {
  if (!data) return new Date().toLocaleDateString("pt-BR");
  if (data?.toDate) return data.toDate().toLocaleDateString("pt-BR");
  if (typeof data === "string") return data;
  return new Date(data).toLocaleDateString("pt-BR");
}

function buildFrase(post: any) {
  const igreja = post.igreja?.trim();
  const data = formatData(post.data);
  const autor = post.autorNome || "Autor";
  if (post.tipo === "sermao") {
    if (igreja && post.data) return `Pregado na ${igreja} · ${data}`;
    if (igreja) return `Pregado na ${igreja}`;
    if (post.data) return `Pregado em ${data}`;
    return `Publicado em ${data}`;
  }
  return `Por ${autor} · ${data}`;
}

function getInitials(name: string) {
  if (!name) return "?";
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// Avatar que usa foto real quando disponível, iniciais como fallback
function AuthorAvatar({ src, name, size = 36 }: { src?: string | null; name: string; size?: number }) {
  const base: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
  };

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{ ...base, objectFit: "cover" }}
        onError={(e) => {
          // Se a imagem falhar, esconde e mostra as iniciais via estado
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }

  return (
    <div
      style={{
        ...base,
        background: "linear-gradient(135deg, var(--emerald-dark), var(--emerald))",
        color: "#fff",
        fontSize: Math.round(size * 0.36) + "px",
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
      }}
    >
      {getInitials(name)}
    </div>
  );
}

function PostCard({ post, index, onAuthorClick }: {
  post: any;
  index: number;
  onAuthorClick: (e: React.MouseEvent, id: string) => void;
}) {
  const router = useRouter();
  const [liked, setLiked] = useState(false);

  const url = `/posts/${post.tipo === "sermao" ? "sermoes" : "artigos"}/${post.slug}`;

  return (
    <article className="post-card" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="card-header-row">
        <AuthorAvatar src={post.autorFoto} name={post.autorNome || "Autor"} size={36} />
        <div className="author-col">
          <span
            className="author-name-link"
            onClick={(e) => onAuthorClick(e, post.autorId)}
          >
            {post.autorNome || "Autor"}
          </span>
          <span className="card-meta">{buildFrase(post)}</span>
        </div>
        <span className={`cat-badge ${post.tipo === "sermao" ? "cat-sermao" : "cat-artigo"}`}>
          {post.tipo === "sermao" ? "Sermão" : "Artigo"}
        </span>
      </div>

      <div className="card-body-area" onClick={() => router.push(url)}>
        <h2 className="card-title">{post.titulo}</h2>
        {post.resumo && <p className="card-frase">{post.resumo}</p>}
      </div>

      <div className="card-footer-row">
        <button
          className={`action-btn ${liked ? "liked" : ""}`}
          onClick={(e) => { e.stopPropagation(); setLiked((v) => !v); }}
        >
          {liked ? "❤️" : "🤍"} Amei
        </button>
        <button
          className="action-btn"
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard?.writeText(window.location.origin + url);
          }}
        >
          🔗 Compartilhar
        </button>
        <span className="read-link" onClick={() => router.push(url)}>
          Ler completo →
        </span>
      </div>
    </article>
  );
}

type Filtro = "todos" | "sermao" | "artigo";

export default function Posts() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const router = useRouter();

  useEffect(() => {
    async function fetchPosts() {
      try {
        const q = query(collection(db, "posts"), orderBy("data", "desc"));
        const snapshot = await getDocs(q);
        const lista: any[] = [];
        snapshot.forEach((doc) => lista.push({ id: doc.id, ...doc.data() }));
        setPosts(lista);
      } catch (error) {
        console.error("Erro ao buscar posts:", error);
      }
      setLoading(false);
    }
    fetchPosts();
  }, []);

  const postsFiltrados =
    filtro === "todos" ? posts : posts.filter((p) => p.tipo === filtro);

  function handleAuthorClick(e: React.MouseEvent, autorId: string) {
    e.stopPropagation();
    router.push(`/perfil/${autorId}`);
  }

  return (
    <div className="feed-wrapper">
      {/* Feed principal */}
      <div>
        <div className="feed-main-header">
          <h1 className="feed-main-title">Publicações Recentes</h1>
          <div className="feed-filters">
            {(["todos", "sermao", "artigo"] as Filtro[]).map((f) => (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                className={`filter-btn ${filtro === f ? "active" : ""}`}
              >
                {f === "todos" ? "Todos" : f === "sermao" ? "Sermões" : "Artigos"}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner" />
            Carregando publicações...
          </div>
        ) : postsFiltrados.length === 0 ? (
          <div className="empty-state">Nenhuma publicação encontrada.</div>
        ) : (
          <div className="posts-list">
            {postsFiltrados.map((post, i) => (
              <PostCard
                key={post.id}
                post={post}
                index={i}
                onAuthorClick={handleAuthorClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* Sidebar */}
      <aside className="feed-sidebar">
        <div className="sidebar-card">
          <h3 className="sidebar-title">🔥 Em Alta</h3>
          <ul className="trending-list">
            {posts.slice(0, 4).map((p) => (
              <li key={p.id}>
                <Link
                  href={`/posts/${p.tipo === "sermao" ? "sermoes" : "artigos"}/${p.slug}`}
                  className="trending-link"
                >
                  <span className="trending-text">{p.titulo}</span>
                  <span className="trending-count">
                    {p.tipo === "sermao" ? "🎤" : "📝"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="sidebar-card sidebar-cta">
          <div style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>✍️</div>
          <h3>Compartilhe sua fé</h3>
          <p>Publique seu sermão ou reflexão e edifique a comunidade.</p>
          <Link href="/criar-post" className="btn-cta">
            Publicar agora
          </Link>
        </div>

        <div className="sidebar-card">
          <h3 className="sidebar-title">📖 Versículo do Dia</h3>
          <blockquote className="verse-blockquote">
            "Porque eu bem sei os pensamentos que tenho a vosso respeito,
            diz o SENHOR; pensamentos de paz, e não de mal."
          </blockquote>
          <p className="verse-ref-text">— Jeremias 29:11</p>
        </div>
      </aside>
    </div>
  );
}
