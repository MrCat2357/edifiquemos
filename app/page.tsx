"use client";

import { useEffect, useState, useRef, useCallback } from "react";
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
import { useAuth } from "@/lib/useAuth";
import { gerarPDF } from "@/lib/gerarPDF";

const PAGE_SIZE = 8;

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
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

/* ─── SVG Icons ───────────────────────────────────────── */

function IconDownload({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M8 2v7M8 9l-2.5-2.5M8 9l2.5-2.5"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconHeart({ size = 13, filled = false }: { size?: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path
        d="M8 13.5C8 13.5 1.5 9.5 1.5 5.5C1.5 3.567 3.067 2 5 2C6.105 2 7.093 2.535 7.75 3.366L8 3.7L8.25 3.366C8.907 2.535 9.895 2 11 2C12.933 2 14.5 3.567 14.5 5.5C14.5 9.5 8 13.5 8 13.5Z"
        stroke="currentColor" strokeWidth="1.4"
        fill={filled ? "currentColor" : "none"}
        strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

function IconEye({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M1.5 8C3 4.5 5.3 3 8 3s5 1.5 6.5 5C13 11.5 10.7 13 8 13S3 11.5 1.5 8Z"
        stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

/* ─── AuthorAvatar ────────────────────────────────────── */

function AuthorAvatar({ src, name, size = 36 }: { src?: string | null; name: string; size?: number }) {
  const base: React.CSSProperties = { width: size, height: size, borderRadius: "50%", flexShrink: 0 };
  if (src) return <img src={src} alt={name} style={{ ...base, objectFit: "cover" }} />;
  return (
    <div style={{
      ...base,
      background: "linear-gradient(135deg, var(--emerald-dark), var(--emerald))",
      color: "#fff", fontSize: Math.round(size * 0.36) + "px", fontWeight: 700,
      display: "flex", alignItems: "center", justifyContent: "center", userSelect: "none",
    }}>
      {getInitials(name)}
    </div>
  );
}

/* ─── Toast ───────────────────────────────────────────── */

function Toast({ msg, visible }: { msg: string; visible: boolean }) {
  return (
    <div style={{
      position: "fixed", bottom: "1.5rem", left: "50%",
      transform: `translateX(-50%) translateY(${visible ? 0 : "12px"})`,
      background: "var(--bg-elevated)", border: "1px solid var(--emerald-dim)",
      color: "var(--emerald)", fontSize: "0.82rem", fontWeight: 600,
      padding: "8px 20px", borderRadius: "var(--radius-full)",
      boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
      opacity: visible ? 1 : 0, transition: "all 0.25s ease",
      pointerEvents: "none", zIndex: 999,
    }}>
      {msg}
    </div>
  );
}

/* ─── PostCard ─────────────────────────────────────────── */

function PostCard({ post, index, onAuthorClick, onToast }: {
  post: any; index: number;
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
  const [downloadCount, setDownloadCount] = useState<number>(post.downloads ?? 0);

  const viewCount: number = post.visualizacoes ?? 0;
  const temImagem = !!post.imagemUrl;
  const url = `/posts/${post.tipo === "sermao" ? "sermoes" : "artigos"}/${post.slug}`;
  const fullUrl = typeof window !== "undefined" ? window.location.origin + url : url;

  async function handleLike(e: React.MouseEvent) {
    e.stopPropagation();
    if (!uid) { onToast("Faça login para curtir"); return; }
    if (loadingLike) return;
    setLoadingLike(true);
    try {
      const ref = doc(db, "posts", post.id);
      if (liked) {
        await updateDoc(ref, { likes: increment(-1), likedBy: arrayRemove(uid) });
        setLiked(false); setLikeCount((n) => Math.max(0, n - 1));
      } else {
        await updateDoc(ref, { likes: increment(1), likedBy: arrayUnion(uid) });
        setLiked(true); setLikeCount((n) => n + 1);
      }
    } catch (err) { console.error(err); }
    setLoadingLike(false);
  }

  async function handleDownloadPdf(e: React.MouseEvent) {
    e.stopPropagation();
    if (gerandoPdf) return;
    setGerandoPdf(true);
    onToast("Gerando PDF...");
    try {
      await gerarPDF({
        titulo: post.titulo, nomeAutor: post.autorNome || "Autor",
        fotoAutor: post.autorFoto ?? null, dataPost: formatData(post.data),
        igreja: post.igreja || "",
        conteudo: post.conteudo || "Acesse o link para ler o conteúdo completo:\n" + fullUrl,
        tipo: post.tipo,
        onDownload: async () => {
          try {
            await updateDoc(doc(db, "posts", post.id), { downloads: increment(1) });
            setDownloadCount((n) => n + 1);
          } catch {}
        },
      });
    } catch (err) { console.error(err); onToast("Erro ao gerar PDF."); }
    setGerandoPdf(false);
  }

  const footerRow = (
    <div className="card-footer-row"
      style={{ display: "flex", alignItems: "center", gap: "0" }}
      onClick={(e) => e.stopPropagation()}>
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <button className={`action-btn ${liked ? "liked" : ""}`} onClick={handleLike}
          disabled={loadingLike}
          title={uid ? (liked ? "Remover curtida" : "Curtir") : "Faça login para curtir"}
          style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: 0, background: "none", border: "none" }}>
          <IconHeart size={13} filled={liked} />
          Amei
          {likeCount > 0 && <span style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>{likeCount}</span>}
        </button>

        <button className="action-btn" onClick={handleDownloadPdf} disabled={gerandoPdf}
          title="Baixar como PDF"
          style={{ opacity: gerandoPdf ? 0.6 : 1, display: "inline-flex", alignItems: "center", gap: "4px", padding: 0, background: "none", border: "none" }}>
          {gerandoPdf ? <><span className="btn-spinner" />PDF</> : <><IconDownload size={13} />PDF</>}
          {downloadCount > 0 && (
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-3)" }}
              title={`${downloadCount} download${downloadCount !== 1 ? "s" : ""}`}>
              {downloadCount}
            </span>
          )}
        </button>

        {viewCount > 0 && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "0.72rem", fontWeight: 600, color: "var(--text-3)" }}
            title={`${viewCount} visualização${viewCount !== 1 ? "ões" : ""}`}>
            <IconEye size={13} />{viewCount}
          </span>
        )}
      </div>
      <span className="read-link" style={{ marginLeft: "auto" }} onClick={() => router.push(url)}>
        Ler completo →
      </span>
    </div>
  );

  if (temImagem) {
    return (
      <article className="post-card post-card-image" style={{ animationDelay: `${index * 60}ms` }}
        onClick={() => router.push(url)}>
        <div className="card-cover-wrapper">
          <img src={post.imagemUrl} alt={post.titulo} className="card-cover-img" />
          <span className={`cat-badge card-cover-badge ${post.tipo === "sermao" ? "cat-sermao" : "cat-artigo"}`}>
            {post.tipo === "sermao" ? "Sermão" : "Artigo"}
          </span>
        </div>
        <div className="card-image-content">
          <div className="card-header-row" style={{ padding: "0.875rem 1.125rem 0.375rem" }}
            onClick={(e) => e.stopPropagation()}>
            <AuthorAvatar src={post.autorFoto} name={post.autorNome || "Autor"} size={28} />
            <div className="author-col" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <span className="author-name-link"
                onClick={(e) => { e.stopPropagation(); onAuthorClick(e, post.autorId); }}
                style={{ display: "inline", width: "fit-content", alignSelf: "flex-start", fontSize: "0.8rem" }}>
                {post.autorNome || "Autor"}
              </span>
              <span className="card-meta">{buildFrase(post)}</span>
            </div>
          </div>
          <div className="card-body-area" style={{ padding: "0 1.125rem 0.75rem" }}>
            <h2 className="card-title" style={{ fontSize: "1rem" }}>{post.titulo}</h2>
            {post.resumo && <p className="card-frase">{post.resumo}</p>}
          </div>
          {footerRow}
        </div>
      </article>
    );
  }

  return (
    <article className="post-card" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="card-header-row" onClick={() => router.push(url)} style={{ cursor: "pointer" }}>
        <AuthorAvatar src={post.autorFoto} name={post.autorNome || "Autor"} size={36} />
        <div className="author-col" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <span className="author-name-link"
            onClick={(e) => { e.stopPropagation(); onAuthorClick(e, post.autorId); }}
            style={{ display: "inline", width: "fit-content", alignSelf: "flex-start" }}>
            {post.autorNome || "Autor"}
          </span>
          <span className="card-meta">{buildFrase(post)}</span>
        </div>
        <span className={`cat-badge ${post.tipo === "sermao" ? "cat-sermao" : "cat-artigo"}`}>
          {post.tipo === "sermao" ? "Sermão" : "Artigo"}
        </span>
      </div>
      <div className="card-body-area" onClick={() => router.push(url)} style={{ cursor: "pointer" }}>
        <h2 className="card-title">{post.titulo}</h2>
        {post.resumo && <p className="card-frase">{post.resumo}</p>}
      </div>
      {footerRow}
    </article>
  );
}

/* ─── HomePage ─────────────────────────────────────────── */

export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();

  const [allPosts, setAllPosts] = useState<any[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchPosts() {
      try {
        const q = query(collection(db, "posts"), orderBy("data", "desc"));
        const snapshot = await getDocs(q);
        const lista: any[] = [];
        snapshot.forEach((d) => lista.push({ id: d.id, ...d.data() }));
        setAllPosts(lista);
      } catch (error) {
        console.error("Erro ao buscar posts:", error);
      }
      setLoading(false);
    }
    fetchPosts();
  }, []);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + PAGE_SIZE);
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loading]);

  function showToast(msg: string) {
    setToastMsg(msg);
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2200);
  }

  function handleAuthorClick(e: React.MouseEvent, autorId: string) {
    e.stopPropagation();
    router.push(`/perfil/${autorId}`);
  }

  // Scroll suave para o feed sem modificar a URL
  function scrollToFeed(e: React.MouseEvent) {
    e.preventDefault();
    feedRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const visiblePosts = allPosts.slice(0, visibleCount);
  const hasMore = visibleCount < allPosts.length;

  return (
    <>
      <Toast msg={toastMsg} visible={toastVisible} />

      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero-grid" />
        <div className="hero-content">
          <div className="hero-eyebrow">
            <span className="hero-eyebrow-dot" />
            Edificação Mútua
          </div>
          <h1 className="hero-title">
            Sermões e Reflexões
            <br />
            <span className="hero-title-accent">para Crescer na Fé</span>
          </h1>
          <blockquote className="hero-verse">
            "Por isso, exortem-se e edifiquem-se uns aos outros,
            como de fato vocês estão fazendo."
            <cite>1 Tessalonicenses 5:11</cite>
          </blockquote>
          <div className="hero-actions">
            {/* botão sem âncora — scroll via JS, URL fica limpa */}
            <button className="btn-hero-primary" onClick={scrollToFeed}>
              Explorar Conteúdos
            </button>
            {user ? (
              <Link href="/criar-post" className="btn-hero-secondary">
                Publicar Sermão ou Artigo
              </Link>
            ) : (
              <Link href="/login" className="btn-hero-secondary">
                Entrar para Publicar
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ── Feed ── */}
      {/* ref aqui — é o alvo do scroll suave */}
      <div ref={feedRef} className="feed-wrapper">
        {/* Coluna principal */}
        <div>
          <div className="feed-main-header">
            <h1 className="feed-main-title">Publicações Recentes</h1>
          </div>

          {loading ? (
            <div className="loading-state">
              <div className="spinner" />
              Carregando publicações...
            </div>
          ) : allPosts.length === 0 ? (
            <div className="empty-state">Nenhuma publicação encontrada.</div>
          ) : (
            <>
              <div className="posts-list">
                {visiblePosts.map((post, i) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    index={i}
                    onAuthorClick={handleAuthorClick}
                    onToast={showToast}
                  />
                ))}
              </div>

              <div ref={sentinelRef} style={{ height: 1 }} />

              {hasMore && (
                <div className="loading-state" style={{ padding: "1.5rem 0" }}>
                  <div className="spinner" />
                  Carregando mais...
                </div>
              )}

              {!hasMore && allPosts.length > PAGE_SIZE && (
                <p style={{
                  textAlign: "center", fontSize: "0.82rem",
                  color: "var(--text-3)", padding: "2rem 0 1rem",
                  fontStyle: "italic",
                }}>
                  Você chegou ao fim das publicações.
                </p>
              )}
            </>
          )}
        </div>

        {/* Sidebar */}
        <aside className="feed-sidebar">
          <div className="sidebar-card">
            <h3 className="sidebar-title">🔥 Em Alta</h3>
            <ul className="trending-list">
              {allPosts.slice(0, 4).map((p) => (
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
            <Link href="/criar-post" className="btn-cta">Publicar agora</Link>
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

      <style>{`
        .post-card-image { cursor: pointer; }

        .card-cover-wrapper {
          position: relative; width: 100%;
          max-height: 420px; min-height: 160px;
          overflow: hidden;
          border-radius: var(--radius-lg) var(--radius-lg) 0 0;
          background: #0d1310;
          display: flex; align-items: center; justify-content: center;
        }
        .card-cover-img {
          width: 100%; height: 100%;
          object-fit: contain; display: block;
          max-height: 420px;
          transition: transform 0.35s ease;
        }
        .post-card-image:hover .card-cover-img { transform: scale(1.025); }
        .card-cover-badge {
          position: absolute; top: 0.625rem; right: 0.75rem;
          backdrop-filter: blur(6px);
          background: rgba(10, 15, 10, 0.72) !important;
        }
        .card-image-content { display: flex; flex-direction: column; }

        @media (max-width: 640px) {
          .card-cover-wrapper { max-height: 320px; min-height: 120px; }
          .card-cover-img { max-height: 320px; }
        }
      `}</style>
    </>
  );
}