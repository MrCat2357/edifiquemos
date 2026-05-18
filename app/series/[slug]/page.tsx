"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
  increment,
} from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import { gerarPDF } from "@/lib/gerarPDF";
import BannerLogin from "@/components/BannerLogin";
import dynamic from "next/dynamic";

const CommentSection = dynamic(
  () => import("@/components/comments/CommentSection"),
  { ssr: false, loading: () => null }
);

function getInitials(name: string) {
  if (!name) return "?";
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function formatData(data: any) {
  if (!data) return "";
  if (data?.toDate) return data.toDate().toLocaleDateString("pt-BR");
  if (typeof data === "string") return data;
  return new Date(data).toLocaleDateString("pt-BR");
}

function Avatar({ src, name, size = 36 }: { src?: string | null; name: string; size?: number }) {
  if (src) return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "linear-gradient(135deg, var(--emerald-dark), var(--emerald))",
      color: "#fff", fontSize: Math.round(size * 0.36) + "px", fontWeight: 700,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, userSelect: "none",
    }}>
      {getInitials(name)}
    </div>
  );
}

function IconHeart({ size = 13, filled = false }: { size?: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M8 13.5C8 13.5 1.5 9.5 1.5 5.5C1.5 3.567 3.067 2 5 2C6.105 2 7.093 2.535 7.75 3.366L8 3.7L8.25 3.366C8.907 2.535 9.895 2 11 2C12.933 2 14.5 3.567 14.5 5.5C14.5 9.5 8 13.5 8 13.5Z"
        stroke="currentColor" strokeWidth="1.4" fill={filled ? "currentColor" : "none"} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconComment({ size = 13, active = false }: { size?: number; active?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path
        d="M2 3.5A1.5 1.5 0 0 1 3.5 2h9A1.5 1.5 0 0 1 14 3.5v6A1.5 1.5 0 0 1 12.5 11H9l-3 3v-3H3.5A1.5 1.5 0 0 1 2 9.5v-6Z"
        stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round"
        fill={active ? "currentColor" : "none"}
      />
    </svg>
  );
}

function IconEye({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M1.5 8C3 4.5 5.3 3 8 3s5 1.5 6.5 5C13 11.5 10.7 13 8 13S3 11.5 1.5 8Z" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function IconDownload({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M8 2v7M8 9l-2.5-2.5M8 9l2.5-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── PostCardSerie ────────────────────────────────────────────────────────────

function PostCardSerie({
  post,
  index,
  serieSlug,
  onToast,
}: {
  post: any;
  index: number;
  serieSlug: string;
  onToast: (msg: string) => void;
}) {
  const router = useRouter();
  const uid = auth.currentUser?.uid;

  const [liked, setLiked] = useState<boolean>(() => uid ? (post.likedBy ?? []).includes(uid) : false);
  const [likeCount, setLikeCount] = useState<number>(post.likes ?? 0);
  const [loadingLike, setLoadingLike] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [downloadCount, setDownloadCount] = useState<number>(post.downloads ?? 0);
  const [showLoginBanner, setShowLoginBanner] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState<number>(post.commentCount ?? 0);

  const viewCount: number = post.visualizacoes ?? 0;
  const temImagem = !!post.imagemUrl;

  const postBasePath = `/posts/${post.tipo === "sermao" ? "sermoes" : "estudos"}/${post.slug}`;
  const postPathSerie = `${postBasePath}?from=serie&serieSlug=${serieSlug}`;
  const fullUrl = typeof window !== "undefined" ? `${window.location.origin}${postBasePath}` : postBasePath;

  function buildFrase() {
    const data = formatData(post.data);
    if (post.tipo === "sermao") {
      if (post.igreja && data) return `Pregado na ${post.igreja} · ${data}`;
      if (post.igreja) return `Pregado na ${post.igreja}`;
      if (data) return `Pregado em ${data}`;
      return "";
    }
    return `Por ${post.autorNome || "Autor"}${data ? ` · ${data}` : ""}`;
  }

  async function handleLike(e: React.MouseEvent) {
    e.stopPropagation();
    if (!uid) { setShowLoginBanner(true); return; }
    if (loadingLike) return;
    setLoadingLike(true);
    try {
      const postRef = doc(db, "posts", post.id);
      if (liked) {
        await updateDoc(postRef, { likes: increment(-1), likedBy: arrayRemove(uid) });
        setLiked(false); setLikeCount((n) => Math.max(0, n - 1));
      } else {
        await updateDoc(postRef, { likes: increment(1), likedBy: arrayUnion(uid) });
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
          try { await updateDoc(doc(db, "posts", post.id), { downloads: increment(1) }); setDownloadCount((n) => n + 1); } catch {}
        },
      });
    } catch (err) { console.error(err); onToast("Erro ao gerar PDF."); }
    setGerandoPdf(false);
  }

  function handleToggleComments(e: React.MouseEvent) {
    e.stopPropagation();
    if (!uid) {
      setShowLoginBanner(true);
      return;
    }
    setShowComments((v) => !v);
  }

  const footerRow = (
    <div className="card-footer-row" style={{ display: "flex", alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        {/* Amei */}
        <button
          className={`action-btn ${liked ? "liked" : ""}`}
          onClick={handleLike}
          disabled={loadingLike}
          title={uid ? (liked ? "Remover curtida" : "Curtir") : "Curtir"}
          style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: 0, background: "none", border: "none" }}
        >
          <IconHeart size={13} filled={liked} />Amei
          {likeCount > 0 && <span style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>{likeCount}</span>}
        </button>

        {/* Comentários */}
        <button
          onClick={handleToggleComments}
          title="Ver comentários"
          style={{
            display: "inline-flex", alignItems: "center", gap: "4px",
            padding: 0, background: "none", border: "none",
            color: showComments ? "var(--emerald)" : "var(--text-3)",
            cursor: "pointer", fontSize: "0.72rem", fontWeight: 600,
            transition: "color 0.15s",
          }}
        >
          <IconComment size={13} active={showComments} />
          Comentários
          {commentCount > 0 && (
            <span style={{ fontSize: "0.72rem", color: "var(--text-3)", fontWeight: 700 }}>
              {commentCount}
            </span>
          )}
        </button>

        {/* PDF */}
        <button
          className="action-btn"
          onClick={handleDownloadPdf}
          disabled={gerandoPdf}
          style={{ opacity: gerandoPdf ? 0.6 : 1, display: "inline-flex", alignItems: "center", gap: "4px", padding: 0, background: "none", border: "none" }}
        >
          {gerandoPdf ? <><span className="btn-spinner" />PDF</> : <><IconDownload size={13} />PDF</>}
          {downloadCount > 0 && <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-3)" }}>{downloadCount}</span>}
        </button>

        {/* Visualizações */}
        {viewCount > 0 && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "0.72rem", fontWeight: 600, color: "var(--text-3)" }}>
            <IconEye size={13} />{viewCount}
          </span>
        )}
      </div>
      <span className="read-link" style={{ marginLeft: "auto" }} onClick={() => router.push(postPathSerie)}>
        Ler completo →
      </span>
    </div>
  );

  // Painel de comentários — igual ao PostCard do feed principal
  const commentsPanel = showComments && (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        borderTop: "1px solid var(--border-light)",
        padding: "1.25rem 1.125rem 1.5rem",
        background: "var(--bg-elevated)",
        borderRadius: "0 0 var(--radius-lg) var(--radius-lg)",
      }}
    >
      <CommentSection
        postId={post.id}
        onCountChange={setCommentCount}
      />
    </div>
  );

  if (temImagem) {
    return (
      <article className="post-card post-card-image" style={{ animationDelay: `${index * 60}ms` }} onClick={() => router.push(postPathSerie)}>
        <div className="card-cover-wrapper">
          <img src={post.imagemUrl} alt={post.titulo} className="card-cover-img" />
          <span className={`cat-badge card-cover-badge ${post.tipo === "sermao" ? "cat-sermao" : "cat-artigo"}`}>
            {post.tipo === "sermao" ? "Sermão" : "Estudo"}
          </span>
        </div>
        <div className="card-image-content">
          <div className="card-header-row" style={{ padding: "0.875rem 1.125rem 0.375rem" }} onClick={(e) => e.stopPropagation()}>
            <Avatar src={post.autorFoto} name={post.autorNome || "Autor"} size={28} />
            <div className="author-col" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <span className="author-name-link" onClick={() => router.push(`/perfil/${post.autorId}`)} style={{ fontSize: "0.8rem" }}>{post.autorNome || "Autor"}</span>
              <span className="card-meta">{buildFrase()}</span>
            </div>
          </div>
          <div className="card-body-area" style={{ padding: "0 1.125rem 0.75rem" }}>
            <h2 className="card-title" style={{ fontSize: "1rem" }}>{post.titulo}</h2>
            {post.resumo && <p className="card-frase">{post.resumo}</p>}
          </div>
          {showLoginBanner && (
            <div style={{ padding: "0 1.125rem 0.625rem" }} onClick={(e) => e.stopPropagation()}>
              <BannerLogin onClose={() => setShowLoginBanner(false)} />
            </div>
          )}
          {footerRow}
        </div>
        {commentsPanel}
      </article>
    );
  }

  return (
    <article className="post-card" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="card-header-row" onClick={() => router.push(postPathSerie)} style={{ cursor: "pointer" }}>
        <Avatar src={post.autorFoto} name={post.autorNome || "Autor"} size={36} />
        <div className="author-col" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <span className="author-name-link" onClick={(e) => { e.stopPropagation(); router.push(`/perfil/${post.autorId}`); }}>
            {post.autorNome || "Autor"}
          </span>
          <span className="card-meta">{buildFrase()}</span>
        </div>
        <span className={`cat-badge ${post.tipo === "sermao" ? "cat-sermao" : "cat-artigo"}`}>
          {post.tipo === "sermao" ? "Sermão" : "Estudo"}
        </span>
      </div>
      <div className="card-body-area" onClick={() => router.push(postPathSerie)} style={{ cursor: "pointer" }}>
        <h2 className="card-title">{post.titulo}</h2>
        {post.resumo && <p className="card-frase">{post.resumo}</p>}
      </div>
      {showLoginBanner && (
        <div style={{ padding: "0 1.125rem 0.625rem" }} onClick={(e) => e.stopPropagation()}>
          <BannerLogin onClose={() => setShowLoginBanner(false)} />
        </div>
      )}
      {footerRow}
      {commentsPanel}
    </article>
  );
}

// ─── SeriePage ────────────────────────────────────────────────────────────────

export default function SeriePage() {
  const { slug } = useParams();
  const router = useRouter();

  const [serie, setSerie] = useState<any>(null);
  const [serieId, setSerieId] = useState<string>("");
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  const currentUid = auth.currentUser?.uid;
  const serieSlug = Array.isArray(slug) ? slug[0] : slug ?? "";

  function showToast(msg: string) {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2200);
  }

  useEffect(() => {
    async function carregar() {
      if (!slug) return;
      try {
        const q = query(collection(db, "series"), where("slug", "==", serieSlug));
        const snap = await getDocs(q);
        if (snap.empty) { setLoading(false); return; }

        const serieDoc = snap.docs[0];
        const serieData = serieDoc.data();
        setSerie(serieData);
        setSerieId(serieDoc.id);

        if (serieData.postIds?.length > 0) {
          const postPromises = (serieData.postIds as string[]).map((id) =>
            getDoc(doc(db, "posts", id))
          );
          const postSnaps = await Promise.all(postPromises);
          const lista = postSnaps
            .filter((s) => s.exists())
            .map((s) => ({ id: s.id, ...s.data() }));
          setPosts(lista);
        }
      } catch (err) { console.error(err); }
      setLoading(false);
    }
    carregar();
  }, [slug]);

  async function handleDeletar() {
    if (!confirm("Tem certeza que deseja apagar esta série?")) return;
    try {
      await deleteDoc(doc(db, "series", serieId));
      router.push("/perfil");
    } catch (err) { console.error(err); alert("Erro ao apagar série."); }
  }

  if (loading) return <div className="post-detail-loading"><div className="spinner" />Carregando série...</div>;
  if (!serie) return <div className="post-detail-notfound">Série não encontrada.</div>;

  const isAutor = currentUid === serie.autorId;

  return (
    <>
      <div style={{
        position: "fixed", bottom: "1.5rem", left: "50%",
        transform: `translateX(-50%) translateY(${toastVisible ? 0 : "12px"})`,
        background: "var(--bg-elevated)", border: "1px solid var(--emerald-dim)",
        color: "var(--emerald)", fontSize: "0.82rem", fontWeight: 600,
        padding: "8px 20px", borderRadius: "var(--radius-full)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        opacity: toastVisible ? 1 : 0, transition: "all 0.25s ease",
        pointerEvents: "none", zIndex: 999,
      }}>{toastMsg}</div>

      <div style={{ maxWidth: "680px", margin: "0 auto", padding: "calc(var(--header-h) + 2rem) 1.25rem 4rem" }}>

        {/* Capa */}
        {serie.imagemUrl && (
          <div style={{ borderRadius: "var(--radius-lg)", overflow: "hidden", marginBottom: "1.5rem", maxHeight: "320px" }}>
            <img src={serie.imagemUrl} alt={serie.titulo} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", maxHeight: "320px" }} />
          </div>
        )}

        {/* Cabeçalho */}
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <span style={{
              fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em",
              color: "var(--emerald)", background: "var(--emerald-dim)",
              padding: "3px 10px", borderRadius: "var(--radius-full)",
              textTransform: "uppercase",
            }}>
              📚 Série
            </span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>
              {posts.length} publicação{posts.length !== 1 ? "ões" : ""}
            </span>
          </div>

          <h1 style={{ fontSize: "clamp(1.6rem, 4vw, 2.2rem)", fontWeight: 800, color: "var(--text-1)", letterSpacing: "-0.02em", marginBottom: "0.75rem" }}>
            {serie.titulo}
          </h1>

          {serie.descricao && (
            <p style={{ fontSize: "0.95rem", color: "var(--text-2)", lineHeight: 1.65, marginBottom: "1rem" }}>
              {serie.descricao}
            </p>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            {serie.autorFoto ? (
              <img src={serie.autorFoto} alt={serie.autorNome} style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
            ) : (
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, var(--emerald-dark), var(--emerald))", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "0.65rem", fontWeight: 700 }}>
                {(serie.autorNome || "A")[0].toUpperCase()}
              </div>
            )}
            <span
              className="author-name-link"
              onClick={() => router.push(`/perfil/${serie.autorId}`)}
              style={{ fontSize: "0.85rem", cursor: "pointer" }}
            >
              {serie.autorNome}
            </span>
          </div>

          {isAutor && (
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
              <button
                onClick={() => router.push(`/editar-serie/${serieId}`)}
                className="post-btn-edit"
                style={{ fontSize: "0.82rem" }}
              >
                ✏ Editar série
              </button>
              <button
                onClick={handleDeletar}
                className="post-btn-delete"
                style={{ fontSize: "0.82rem" }}
              >
                🗑 Apagar série
              </button>
            </div>
          )}
        </div>

        <hr style={{ border: "none", borderTop: "1px solid var(--border)", marginBottom: "1.5rem" }} />

        {/* Posts */}
        {posts.length === 0 ? (
          <div className="empty-state">Esta série ainda não tem publicações.</div>
        ) : (
          <div className="posts-list">
            {posts.map((post, i) => (
              <PostCardSerie
                key={post.id}
                post={post}
                index={i}
                serieSlug={serieSlug}
                onToast={showToast}
              />
            ))}
          </div>
        )}
      </div>

      <style>{`
        .post-card-image { cursor: pointer; }
        .card-cover-wrapper { position: relative; width: 100%; max-height: 420px; min-height: 160px; overflow: hidden; border-radius: var(--radius-lg) var(--radius-lg) 0 0; background: #0d1310; display: flex; align-items: center; justify-content: center; }
        .card-cover-img { width: 100%; height: 100%; object-fit: contain; display: block; max-height: 420px; transition: transform 0.35s ease; }
        .post-card-image:hover .card-cover-img { transform: scale(1.025); }
        .card-cover-badge { position: absolute; top: 0.625rem; right: 0.75rem; backdrop-filter: blur(6px); background: rgba(10, 15, 10, 0.72) !important; }
        .card-image-content { display: flex; flex-direction: column; }
        @media (max-width: 640px) {
          .card-cover-wrapper { max-height: 320px; min-height: 120px; }
          .card-cover-img { max-height: 320px; }
        }
      `}</style>
    </>
  );
}