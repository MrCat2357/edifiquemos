"use client";

import { useEffect, useState, useRef } from "react";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  increment,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { gerarPDF } from "@/lib/gerarPDF";

/* ─── helpers ─────────────────────────────────────────── */

function formatData(data: any) {
  if (!data) return "";
  if (data?.toDate) return data.toDate().toLocaleDateString("pt-BR");
  if (typeof data === "string") return data;
  return new Date(data).toLocaleDateString("pt-BR");
}

function buildFrase(post: any) {
  const igreja = post.igreja?.trim();
  const data = formatData(post.data);
  const autor = post.autorNome || "Autor";
  if (post.tipo === "sermao") {
    if (igreja && data) return `Pregado na ${igreja} · ${data}`;
    if (igreja) return `Pregado na ${igreja}`;
    if (data) return `Pregado em ${data}`;
    return "";
  }
  return `Por ${autor}${data ? ` · ${data}` : ""}`;
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

/* ─── SVG Icons nativos ───────────────────────────────── */

function IconDownload({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M8 2v7M8 9l-2.5-2.5M8 9l2.5-2.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 13h10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ─── Sub-componentes ─────────────────────────────────── */

function AuthorAvatar({
  src,
  name,
  size = 36,
}: {
  src?: string | null;
  name: string;
  size?: number;
}) {
  const base: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
  };
  if (src)
    return (
      <img src={src} alt={name} style={{ ...base, objectFit: "cover" }} />
    );
  return (
    <div
      style={{
        ...base,
        background:
          "linear-gradient(135deg, var(--emerald-dark), var(--emerald))",
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

function Toast({ msg, visible }: { msg: string; visible: boolean }) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: "1.5rem",
        left: "50%",
        transform: `translateX(-50%) translateY(${visible ? 0 : "12px"})`,
        background: "var(--bg-elevated)",
        border: "1px solid var(--emerald-dim)",
        color: "var(--emerald)",
        fontSize: "0.82rem",
        fontWeight: 600,
        padding: "8px 20px",
        borderRadius: "var(--radius-full)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        opacity: visible ? 1 : 0,
        transition: "all 0.25s ease",
        pointerEvents: "none",
        zIndex: 999,
      }}
    >
      {msg}
    </div>
  );
}

/* ─── PostCard ─────────────────────────────────────────── */

function PostCard({
  post,
  index,
  onAuthorClick,
  onToast,
}: {
  post: any;
  index: number;
  onAuthorClick: (e: React.MouseEvent, id: string) => void;
  onToast: (msg: string) => void;
}) {
  const router = useRouter();
  const uid = auth.currentUser?.uid;

  const [liked, setLiked] = useState<boolean>(() =>
    uid ? (post.likedBy ?? []).includes(uid) : false
  );
  const [likeCount, setLikeCount] = useState<number>(post.likes ?? 0);
  const [loadingLike, setLoadingLike] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [downloadCount, setDownloadCount] = useState<number>(
    post.downloads ?? 0
  );

  const url = `/posts/${post.tipo === "sermao" ? "sermoes" : "artigos"}/${
    post.slug
  }`;
  const fullUrl =
    typeof window !== "undefined" ? window.location.origin + url : url;

  async function handleLike(e: React.MouseEvent) {
    e.stopPropagation();
    if (!uid) {
      onToast("Faça login para curtir ❤️");
      return;
    }
    if (loadingLike) return;
    setLoadingLike(true);
    try {
      const ref = doc(db, "posts", post.id);
      if (liked) {
        await updateDoc(ref, {
          likes: increment(-1),
          likedBy: arrayRemove(uid),
        });
        setLiked(false);
        setLikeCount((n) => Math.max(0, n - 1));
      } else {
        await updateDoc(ref, {
          likes: increment(1),
          likedBy: arrayUnion(uid),
        });
        setLiked(true);
        setLikeCount((n) => n + 1);
      }
    } catch (err) {
      console.error(err);
    }
    setLoadingLike(false);
  }

  async function handleDownloadPdf(e: React.MouseEvent) {
    e.stopPropagation();
    if (gerandoPdf) return;
    setGerandoPdf(true);
    onToast("Gerando PDF...");
    try {
      await gerarPDF({
        titulo: post.titulo,
        nomeAutor: post.autorNome || "Autor",
        fotoAutor: post.autorFoto ?? null,
        dataPost: formatData(post.data),
        igreja: post.igreja || "",
        conteudo:
          post.conteudo ||
          "Acesse o link para ler o conteúdo completo:\n" + fullUrl,
        tipo: post.tipo,
        onDownload: async () => {
          try {
            await updateDoc(doc(db, "posts", post.id), {
              downloads: increment(1),
            });
            setDownloadCount((n) => n + 1);
          } catch {}
        },
      });
    } catch (err) {
      console.error(err);
      onToast("Erro ao gerar PDF.");
    }
    setGerandoPdf(false);
  }

  return (
    <article
      className="post-card"
      style={{ animationDelay: `${index * 60}ms` }}
    >
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
        <span
          className={`cat-badge ${
            post.tipo === "sermao" ? "cat-sermao" : "cat-artigo"
          }`}
        >
          {post.tipo === "sermao" ? "Sermão" : "Artigo"}
        </span>
      </div>

      <div className="card-body-area" onClick={() => router.push(url)}>
        <h2 className="card-title">{post.titulo}</h2>
        {post.resumo && <p className="card-frase">{post.resumo}</p>}
      </div>

      <div className="card-footer-row">
        {/* ❤️ Amei */}
        <button
          className={`action-btn ${liked ? "liked" : ""}`}
          onClick={handleLike}
          disabled={loadingLike}
          title={
            uid
              ? liked
                ? "Remover curtida"
                : "Curtir"
              : "Faça login para curtir"
          }
        >
          {liked ? "❤️" : "🤍"} Amei
          {likeCount > 0 && (
            <span
              style={{
                marginLeft: 3,
                fontSize: "0.72rem",
                color: "var(--text-3)",
              }}
            >
              {likeCount}
            </span>
          )}
        </button>

        {/* PDF */}
        <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
          <button
            className="action-btn"
            onClick={handleDownloadPdf}
            disabled={gerandoPdf}
            title="Baixar como PDF"
            style={{
              opacity: gerandoPdf ? 0.6 : 1,
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            {gerandoPdf ? (
              <>
                <span className="btn-spinner" />
                PDF
              </>
            ) : (
              <>
                <IconDownload size={13} />
                PDF
              </>
            )}
          </button>
          {downloadCount > 0 && (
            <span
              style={{
                fontSize: "0.72rem",
                fontWeight: 700,
                color: "var(--text-3)",
                padding: "0 4px",
              }}
              title={`${downloadCount} download${
                downloadCount !== 1 ? "s" : ""
              }`}
            >
              {downloadCount}
            </span>
          )}
        </div>

        <span className="read-link" onClick={() => router.push(url)}>
          Ler completo →
        </span>
      </div>
    </article>
  );
}

/* ─── Page ─────────────────────────────────────────────── */

type Filtro = "todos" | "sermao" | "artigo";

export default function Posts() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [sidebarAberta, setSidebarAberta] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchPosts() {
      try {
        const q = query(
          collection(db, "posts"),
          orderBy("data", "desc")
        );
        const snapshot = await getDocs(q);
        const lista: any[] = [];
        snapshot.forEach((d) => lista.push({ id: d.id, ...d.data() }));
        setPosts(lista);
      } catch (error) {
        console.error("Erro ao buscar posts:", error);
      }
      setLoading(false);
    }
    fetchPosts();
  }, []);

  function showToast(msg: string) {
    setToastMsg(msg);
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2200);
  }

  const postsFiltrados =
    filtro === "todos"
      ? posts
      : posts.filter((p) => p.tipo === filtro);

  function handleAuthorClick(e: React.MouseEvent, autorId: string) {
    e.stopPropagation();
    router.push(`/perfil/${autorId}`);
  }

  return (
    <>
      <Toast msg={toastMsg} visible={toastVisible} />

      {/* Overlay mobile para sidebar */}
      {sidebarAberta && (
        <div
          onClick={() => setSidebarAberta(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 40,
          }}
        />
      )}

      <div className="feed-wrapper">
        <div>
          <div className="feed-main-header">
            <h1 className="feed-main-title">Publicações Recentes</h1>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                flexWrap: "wrap",
              }}
            >
              <div className="feed-filters">
                {(["todos", "sermao", "artigo"] as Filtro[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFiltro(f)}
                    className={`filter-btn ${filtro === f ? "active" : ""}`}
                  >
                    {f === "todos"
                      ? "Todos"
                      : f === "sermao"
                      ? "Sermões"
                      : "Artigos"}
                  </button>
                ))}
              </div>

              {/* Botão "Em Alta" visível só em mobile */}
              <button
                className="sidebar-toggle-btn"
                onClick={() => setSidebarAberta(true)}
                aria-label="Ver em alta e mais"
              >
                🔥 Em alta
              </button>
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
                  onToast={showToast}
                />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar — desktop normal, mobile deslizante */}
        <aside
          className={`feed-sidebar${sidebarAberta ? " feed-sidebar--open" : ""}`}
        >
          {/* Botão fechar (só mobile) */}
          <button
            className="sidebar-close-btn"
            onClick={() => setSidebarAberta(false)}
            aria-label="Fechar painel"
          >
            ×
          </button>

          <div className="sidebar-card">
            <h3 className="sidebar-title">🔥 Em Alta</h3>
            <ul className="trending-list">
              {posts.slice(0, 4).map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/posts/${
                      p.tipo === "sermao" ? "sermoes" : "artigos"
                    }/${p.slug}`}
                    className="trending-link"
                    onClick={() => setSidebarAberta(false)}
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
            <div style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>
              ✍️
            </div>
            <h3>Compartilhe sua fé</h3>
            <p>
              Publique seu sermão ou reflexão e edifique a comunidade.
            </p>
            <Link href="/criar-post" className="btn-cta" onClick={() => setSidebarAberta(false)}>
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

      {/* Estilos mobile embutidos */}
      <style>{`
        /* Botão "Em Alta" só aparece em mobile */
        .sidebar-toggle-btn {
          display: none;
          align-items: center;
          gap: 5px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-light);
          color: var(--text-2);
          font-size: 0.8rem;
          font-weight: 600;
          padding: 6px 12px;
          border-radius: var(--radius-full);
          cursor: pointer;
          white-space: nowrap;
        }

        .sidebar-close-btn {
          display: none;
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: none;
          border: none;
          font-size: 1.5rem;
          color: var(--text-3);
          cursor: pointer;
          line-height: 1;
          padding: 4px 8px;
          border-radius: var(--radius-sm);
        }

        @media (max-width: 768px) {
          .sidebar-toggle-btn {
            display: inline-flex;
          }

          .sidebar-close-btn {
            display: block;
          }

          .feed-sidebar {
            position: fixed !important;
            top: 0;
            right: 0;
            bottom: 0;
            width: min(85vw, 320px);
            overflow-y: auto;
            z-index: 50;
            padding: 3.5rem 1rem 2rem;
            transform: translateX(100%);
            transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
            background: var(--bg-card);
            border-left: 1px solid var(--border-light);
            box-shadow: -8px 0 32px rgba(0,0,0,0.4);
          }

          .feed-sidebar--open {
            transform: translateX(0) !important;
          }

          /* Cards maiores em mobile */
          .post-card {
            padding: 1rem !important;
          }

          /* Footer dos cards em coluna em telas muito pequenas */
          @media (max-width: 360px) {
            .card-footer-row {
              flex-wrap: wrap;
              gap: 0.5rem;
            }
          }

          /* Botões de ação com touch targets maiores */
          .action-btn,
          .post-btn-share,
          .filter-btn {
            min-height: 40px;
            padding-top: 8px !important;
            padding-bottom: 8px !important;
          }

          /* Header do feed em coluna */
          .feed-main-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 0.75rem !important;
          }

          /* Título menor */
          .post-detail-title {
            font-size: clamp(1.3rem, 5vw, 2rem) !important;
          }

          /* Ações do post detail empilhadas em mobile */
          .post-detail-actions {
            flex-wrap: wrap;
            gap: 0.5rem;
          }

          /* Navegação entre posts em coluna */
          .post-nav {
            grid-template-columns: 1fr !important;
          }

          /* Meta do post em wrap */
          .post-detail-meta {
            flex-wrap: wrap;
          }
        }
      `}</style>
    </>
  );
}
