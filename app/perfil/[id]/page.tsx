"use client";

import { useEffect, useRef, useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  updateDoc,
  arrayUnion,
  arrayRemove,
  increment,
  deleteDoc,
} from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import { gerarPDF } from "@/lib/gerarPDF";
import { getReflexoesPorAutor } from "@/lib/reflexoes";
import type { Reflexao } from "@/lib/reflexoes";
import CardReflexao from "@/components/reflexoes/CardReflexao";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import BannerLogin from "@/components/BannerLogin";
import dynamic from "next/dynamic";

const CommentSection = dynamic(
  () => import("@/components/comments/CommentSection"),
  { ssr: false, loading: () => null }
);

type User = {
  nome?: string;
  titulo?: string;
  bio?: string;
  slug?: string;
  fotoUrl?: string | null;
};

/* ── Helpers ────────────────────────────────────────── */

function getInitials(name: string) {
  if (!name) return "?";
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function Avatar({ src, name, size = 64 }: { src?: string | null; name: string; size?: number }) {
  if (src) {
    return (
      <img src={src} alt={name} style={{
        width: size, height: size, borderRadius: "50%", objectFit: "cover",
        flexShrink: 0, boxShadow: size >= 56 ? "0 0 0 3px var(--emerald-dim)" : "none",
      }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "linear-gradient(135deg, var(--emerald-dark), var(--emerald))",
      color: "#fff", fontSize: Math.round(size * 0.36) + "px", fontWeight: 700,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0, userSelect: "none",
      boxShadow: size >= 56 ? "0 0 0 3px var(--emerald-dim)" : "none",
    }}>
      {getInitials(name)}
    </div>
  );
}

/* ── SVG Icons ──────────────────────────────────────── */

function IconHeart({ size = 13, filled = false }: { size?: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M8 13.5C8 13.5 1.5 9.5 1.5 5.5C1.5 3.567 3.067 2 5 2C6.105 2 7.093 2.535 7.75 3.366L8 3.7L8.25 3.366C8.907 2.535 9.895 2 11 2C12.933 2 14.5 3.567 14.5 5.5C14.5 9.5 8 13.5 8 13.5Z"
        stroke="currentColor" strokeWidth="1.4" fill={filled ? "currentColor" : "none"} strokeLinecap="round" strokeLinejoin="round" />
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

/* ── Toast ──────────────────────────────────────────── */

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

/* ── resolverUid ────────────────────────────────────── */

async function resolverUid(idOuSlug: string): Promise<{ uid: string; userData: User } | null> {
  const qSlug = query(collection(db, "users"), where("slug", "==", idOuSlug));
  const snapSlug = await getDocs(qSlug);
  if (!snapSlug.empty) {
    const docSnap = snapSlug.docs[0];
    return { uid: docSnap.id, userData: docSnap.data() as User };
  }
  const docRef = doc(db, "users", idOuSlug);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) return { uid: docSnap.id, userData: docSnap.data() as User };
  return null;
}

// ─── BotaoOuvirPerfil ─────────────────────────────────────────────────────────

function BotaoOuvirPerfil({ post, filaAudio = [] }: { post: any; filaAudio?: any[] }) {
  const router = useRouter();
  const { playQueue, playOrToggle, isCurrentlyPlaying, isCurrentPublication, isLoading: audioLoading } = useAudioPlayer();

  const audioAtivo = isCurrentPublication(post.id);
  const audioTocando = isCurrentlyPlaying(post.id);
  const audioCarregando = audioAtivo && audioLoading;

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (!auth.currentUser) {
      router.push(`/entrar?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    const pub = {
      id: post.id,
      tipo: post.tipo,
      titulo: post.titulo,
      autorNome: post.autorNome || "Autor",
      autorFoto: post.autorFoto ?? null,
      slug: post.slug,
      autorSlug: post.autorSlug,
      audioUrl: "https://archive.org/download/testmp3testfile/mpthreetest.mp3",
    };
    if (filaAudio.length > 0) {
      playQueue(pub, filaAudio, "perfil");
    } else {
      playOrToggle(pub);
    }
  }

  return (
    <button
      onClick={handleClick}
      title={audioTocando ? "Pausar" : "Ouvir este conteúdo"}
      style={{
        display: "inline-flex", alignItems: "center", gap: "4px",
        padding: "4px 8px", borderRadius: "var(--radius-full)",
        border: "1px solid",
        borderColor: audioAtivo ? "var(--emerald-dim)" : "transparent",
        background: audioAtivo ? "var(--emerald-dim)" : "transparent",
        color: audioAtivo ? "var(--emerald)" : "var(--text-3)",
        fontSize: "0.72rem", fontWeight: 600,
        cursor: "pointer", transition: "all 0.15s",
        fontFamily: "inherit", flexShrink: 0,
        boxShadow: audioTocando ? "0 0 0 2px var(--emerald-dim)" : "none",
      }}
    >
      {audioCarregando ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
      ) : audioTocando ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v14l11-7-11-7z"/></svg>
      )}
      <span>{audioCarregando ? "Carregando…" : audioTocando ? "Pausar" : audioAtivo ? "Continuar" : "Ouvir"}</span>
      {audioTocando && (
        <span style={{ fontSize: "0.65rem", fontStyle: "italic", opacity: 0.7 }}>· agora</span>
      )}
    </button>
  );
}

function CardReflexaoComOuvir({ reflexao }: { reflexao: Reflexao }) {
  const router = useRouter();
  const { playOrToggle, isCurrentlyPlaying, isCurrentPublication, isLoading: audioLoading } = useAudioPlayer();

  const audioAtivo = isCurrentPublication(reflexao.id ?? "");
  const audioTocando = isCurrentlyPlaying(reflexao.id ?? "");
  const audioCarregando = audioAtivo && audioLoading;

  function handleOuvir(e: React.MouseEvent) {
    e.stopPropagation();
    if (!auth.currentUser) {
      router.push(`/entrar?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    if (!reflexao.id) return;
    playOrToggle({
      id: reflexao.id,
      tipo: "reflexao",
      titulo: reflexao.titulo,
      autorNome: reflexao.autorNome,
      autorFoto: null,
      slug: reflexao.slug,
      autorSlug: reflexao.autorSlug,
      audioUrl: "https://archive.org/download/testmp3testfile/mpthreetest.mp3",
    });
  }

  return (
    <CardReflexao
      reflexao={reflexao}
      botaoOuvir={
        <button
          onClick={handleOuvir}
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.3rem",
            padding: "4px 10px", borderRadius: "var(--radius-full)",
            border: "1px solid",
            borderColor: audioAtivo ? "var(--emerald-dim)" : "transparent",
            background: audioAtivo ? "var(--emerald-dim)" : "transparent",
            color: audioAtivo ? "var(--emerald)" : "var(--text-3)",
            fontSize: "0.75rem", fontWeight: 600,
            cursor: "pointer", transition: "all 0.18s ease", fontFamily: "inherit",
          }}
        >
          {audioCarregando ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
          ) : audioTocando ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v14l11-7-11-7z"/></svg>
          )}
          <span>{audioCarregando ? "Carregando…" : audioTocando ? "Pausar" : audioAtivo ? "Continuar" : "Ouvir"}</span>
        </button>
      }
    />
  );
}

/* ── SerieCardPublico ────────────────────────────────── */

function SerieCardPublico({
  serie, index, isOwner, onToast,
}: {
  serie: any; index: number; isOwner: boolean; onToast: (msg: string) => void;
}) {
  const router = useRouter();
  const uid = auth.currentUser?.uid ?? null;

  const postCount = serie.postIds?.length ?? 0;

  const [liked, setLiked] = useState<boolean>(
    () => (uid ? (serie.likedBy ?? []).includes(uid) : false)
  );
  const [likeCount, setLikeCount] = useState<number>(serie.likes ?? 0);
  const [loadingLike, setLoadingLike] = useState(false);
  const [showLoginBanner, setShowLoginBanner] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState<number>(serie.commentCount ?? 0);

  async function handleLike(e: React.MouseEvent) {
    e.stopPropagation();
    if (!uid) {
      setShowLoginBanner(true);
      return;
    }
    if (loadingLike) return;
    setLoadingLike(true);
    try {
      const ref = doc(db, "series", serie.id);
      if (liked) {
        await updateDoc(ref, { likes: increment(-1), likedBy: arrayRemove(uid) });
        setLiked(false);
        setLikeCount((n) => Math.max(0, n - 1));
      } else {
        await updateDoc(ref, { likes: increment(1), likedBy: arrayUnion(uid) });
        setLiked(true);
        setLikeCount((n) => n + 1);
      }
    } catch (err) {
      console.error(err);
    }
    setLoadingLike(false);
  }

  function handleToggleComments(e: React.MouseEvent) {
    e.stopPropagation();
    if (!uid) {
      setShowLoginBanner(true);
      return;
    }
    setShowComments((v) => !v);
  }

  async function handleDeletar(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Tem certeza que deseja apagar esta série?")) return;
    try {
      await deleteDoc(doc(db, "series", serie.id));
      onToast("Série apagada.");
      router.refresh();
    } catch (err) {
      console.error(err);
      onToast("Erro ao apagar série.");
    }
  }

  return (
    <article
      className="post-card serie-card"
      style={{ animationDelay: `${index * 60}ms`, cursor: "pointer" }}
      onClick={() => router.push(`/series/${serie.slug}`)}
    >
      {serie.imagemUrl && (
        <div className="card-cover-wrapper">
          <img src={serie.imagemUrl} alt={serie.titulo} className="card-cover-img" />
          <span className="cat-badge card-cover-badge" style={{
            background: "rgba(10,15,10,0.72)", backdropFilter: "blur(6px)",
            color: "var(--emerald)", borderColor: "var(--emerald-dim)",
          }}>
            📚 Série
          </span>
        </div>
      )}

      <div style={{ padding: serie.imagemUrl ? "0.875rem 1.125rem 0.875rem" : undefined }}>
        {!serie.imagemUrl && (
          <div className="card-header-row" style={{ cursor: "default" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ flex: 1 }}>
              <span className="card-meta">{postCount} publicação{postCount !== 1 ? "ões" : ""}</span>
            </div>
            <span className="cat-badge" style={{
              color: "var(--emerald)", background: "var(--emerald-dim)", borderColor: "var(--emerald-dim)",
            }}>
              📚 Série
            </span>
          </div>
        )}

        <div className="card-body-area" style={serie.imagemUrl ? { paddingTop: 0 } : undefined}>
          {serie.imagemUrl && (
            <p className="card-meta" style={{ marginBottom: "0.375rem" }}>
              {postCount} publicação{postCount !== 1 ? "ões" : ""}
            </p>
          )}
          <h2 className="card-title" style={serie.imagemUrl ? { fontSize: "1rem" } : undefined}>
            {serie.titulo}
          </h2>
          {serie.descricao && <p className="card-frase">{serie.descricao}</p>}
        </div>

        {showLoginBanner && (
          <div style={{ padding: "0 0 0.625rem" }} onClick={(e) => e.stopPropagation()}>
            <BannerLogin onClose={() => setShowLoginBanner(false)} />
          </div>
        )}

        <div
          className="card-footer-row"
          style={{ display: "flex", alignItems: "center", gap: "0" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            {isOwner && (
              <div style={{ display: "flex", gap: "0.5rem", marginRight: "4px" }}>
                <button
                  onClick={(e) => { e.stopPropagation(); router.push(`/editar-serie/${serie.id}`); }}
                  className="post-btn-edit"
                  style={{ fontSize: "0.78rem", padding: "5px 12px" }}
                >
                  ✏ Editar
                </button>
                <button
                  onClick={handleDeletar}
                  className="post-btn-delete"
                  style={{ fontSize: "0.78rem", padding: "5px 12px" }}
                >
                  🗑 Apagar
                </button>
              </div>
            )}

            <button
              className={`action-btn ${liked ? "liked" : ""}`}
              onClick={handleLike}
              disabled={loadingLike}
              title={uid ? (liked ? "Remover curtida" : "Curtir") : "Curtir"}
              style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: 0, background: "none", border: "none" }}
            >
              <IconHeart size={13} filled={liked} />
              Amei
              {likeCount > 0 && (
                <span style={{ fontSize: "0.72rem", color: liked ? "inherit" : "var(--emerald)", fontWeight: 700 }}>
                  {likeCount}
                </span>
              )}
            </button>

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
          </div>

          <span
            className="read-link"
            style={{ marginLeft: "auto" }}
            onClick={() => router.push(`/series/${serie.slug}`)}
          >
            Ver série →
          </span>
        </div>
      </div>

      {showComments && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            borderTop: "1px solid var(--border-light)",
            padding: "1.25rem 1.125rem 1.5rem",
            background: "var(--bg-elevated)",
            borderRadius: "0 0 var(--radius-lg) var(--radius-lg)",
          }}
        >
          <CommentSection postId={serie.id} onCountChange={setCommentCount} />
        </div>
      )}
    </article>
  );
}

/* ── PostCardPerfil ─────────────────────────────────── */

function PostCardPerfil({
  post, index, user, nomeExibicao, autorUid, isOwner, onToast, filaAudio = [],
}: {
  post: any; index: number; user: User; nomeExibicao: string;
  autorUid: string; isOwner: boolean; onToast: (msg: string) => void;
  filaAudio?: any[];
}) {
  const router = useRouter();
  const currentUid = auth.currentUser?.uid;

  const [liked, setLiked] = useState<boolean>(() =>
    currentUid ? (post.likedBy ?? []).includes(currentUid) : false
  );
  const [likeCount, setLikeCount] = useState<number>(post.likes ?? 0);
  const [loadingLike, setLoadingLike] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [downloadCount, setDownloadCount] = useState<number>(post.downloads ?? 0);
  const [showLoginBanner, setShowLoginBanner] = useState(false);
  const [showComments, setShowComments] = useState(false);

  const viewCount: number = post.visualizacoes ?? 0;
  const temImagem = !!post.imagemUrl;

  // ?from=perfil — indica ao PostDetailContent que deve navegar pelos posts do mesmo autor
  const postPath = `/posts/${post.tipo === "sermao" ? "sermoes" : "estudos"}/${post.slug}?from=perfil`;
  const fullUrl = typeof window !== "undefined"
    ? `${window.location.origin}/posts/${post.tipo === "sermao" ? "sermoes" : "estudos"}/${post.slug}`
    : `/posts/${post.tipo === "sermao" ? "sermoes" : "estudos"}/${post.slug}`;

  function buildFrase() {
    const data = post.data?.toDate
      ? post.data.toDate().toLocaleDateString("pt-BR")
      : typeof post.data === "string" ? post.data : "";
    if (post.tipo === "sermao") {
      if (post.igreja && data) return `Pregado na ${post.igreja} · ${data}`;
      if (post.igreja) return `Pregado na ${post.igreja}`;
      if (data) return `Pregado em ${data}`;
      return "";
    }
    return `Por ${nomeExibicao}${data ? ` · ${data}` : ""}`;
  }

  async function handleLike(e: React.MouseEvent) {
    e.stopPropagation();
    if (!currentUid) {
      setShowLoginBanner(true);
      return;
    }
    if (loadingLike) return;
    setLoadingLike(true);
    try {
      const postRef = doc(db, "posts", post.id);
      if (liked) {
        await updateDoc(postRef, { likes: increment(-1), likedBy: arrayRemove(currentUid) });
        setLiked(false); setLikeCount((n) => Math.max(0, n - 1));
      } else {
        await updateDoc(postRef, { likes: increment(1), likedBy: arrayUnion(currentUid) });
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
        titulo: post.titulo, nomeAutor: nomeExibicao,
        fotoAutor: user.fotoUrl ?? null,
        dataPost: post.data?.toDate ? post.data.toDate().toLocaleDateString("pt-BR") : typeof post.data === "string" ? post.data : "",
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

  async function handleDeletar(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Tem certeza que deseja apagar este post?")) return;
    try {
      await deleteDoc(doc(db, "posts", post.id));
      onToast("Post apagado.");
      router.refresh();
    } catch (err) {
      console.error(err);
      onToast("Erro ao apagar post.");
    }
  }

  const ownerButtons = isOwner ? (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); router.push(`/editar-post/${post.id}`); }}
        className="post-btn-edit"
        style={{ fontSize: "0.78rem", padding: "5px 12px" }}
      >
        ✏ Editar
      </button>
      <button
        onClick={handleDeletar}
        className="post-btn-delete"
        style={{ fontSize: "0.78rem", padding: "5px 12px" }}
      >
        🗑 Apagar
      </button>
    </>
  ) : null;

  const footerRow = (
    <div className="card-footer-row" style={{ display: "flex", alignItems: "center", gap: "0" }}
      onClick={(e) => e.stopPropagation()}>
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        {isOwner && (
          <div style={{ display: "flex", gap: "0.5rem", marginRight: "4px" }}>
            {ownerButtons}
          </div>
        )}
        <button className={`action-btn ${liked ? "liked" : ""}`} onClick={handleLike}
          disabled={loadingLike}
          title={currentUid ? (liked ? "Remover curtida" : "Curtir") : "Curtir"}
          style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: 0, background: "none", border: "none" }}>
          <IconHeart size={13} filled={liked} />
          Amei
          {likeCount > 0 && <span style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>{likeCount}</span>}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!currentUid) {
              setShowLoginBanner(true);
              return;
            }
            setShowComments((v) => !v);
          }}
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
          {(post.commentCount ?? 0) > 0 && (
            <span style={{ fontSize: "0.72rem", color: "var(--text-3)", fontWeight: 700 }}>
              {post.commentCount}
            </span>
          )}
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

        <BotaoOuvirPerfil post={post} filaAudio={filaAudio} />
      </div>
      <span className="read-link" style={{ marginLeft: "auto" }} onClick={() => router.push(postPath)}>
        Ler completo →
      </span>
    </div>
  );

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
      <CommentSection postId={post.id} />
    </div>
  );

  if (temImagem) {
    return (
      <article className="post-card post-card-image" style={{ animationDelay: `${index * 60}ms` }}
        onClick={() => router.push(postPath)}>
        <div className="card-cover-wrapper">
          <img src={post.imagemUrl} alt={post.titulo} className="card-cover-img" />
          <span className={`cat-badge card-cover-badge ${post.tipo === "sermao" ? "cat-sermao" : "cat-artigo"}`}>
            {post.tipo === "sermao" ? "Sermão" : "Estudo"}
          </span>
        </div>
        <div className="card-image-content">
          <div className="card-header-row" style={{ padding: "0.875rem 1.125rem 0.375rem" }}
            onClick={(e) => e.stopPropagation()}>
            <Avatar src={user.fotoUrl} name={nomeExibicao} size={28} />
            <div className="author-col" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <span className="author-name-link" style={{ display: "inline", width: "fit-content", alignSelf: "flex-start", fontSize: "0.8rem", cursor: "default" }}>
                {nomeExibicao}
              </span>
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
      <div className="card-header-row" onClick={() => router.push(postPath)} style={{ cursor: "pointer" }}>
        <Avatar src={user.fotoUrl} name={nomeExibicao} size={36} />
        <div className="author-col" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <span className="author-name-link" onClick={(e) => e.stopPropagation()}
            style={{ display: "inline", width: "fit-content", alignSelf: "flex-start", cursor: "default" }}>
            {nomeExibicao}
          </span>
          <span className="card-meta">{buildFrase()}</span>
        </div>
        <span className={`cat-badge ${post.tipo === "sermao" ? "cat-sermao" : "cat-artigo"}`}>
          {post.tipo === "sermao" ? "Sermão" : "Estudo"}
        </span>
      </div>
      <div className="card-body-area" onClick={() => router.push(postPath)} style={{ cursor: "pointer" }}>
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

/* ── CardReflexaoComControles ─────────────────────────── */

function CardReflexaoComControles({
  reflexao, index, isOwner, onToast,
}: {
  reflexao: Reflexao; index: number; isOwner: boolean; onToast: (msg: string) => void;
}) {
  const router = useRouter();

  async function handleDeletar(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Tem certeza que deseja apagar esta reflexão?")) return;
    try {
      await deleteDoc(doc(db, "reflexoes", reflexao.id!));
      onToast("Reflexão apagada.");
      router.refresh();
    } catch (err) {
      console.error(err);
      onToast("Erro ao apagar reflexão.");
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <CardReflexaoComOuvir reflexao={reflexao} />
      {isOwner && (
        <div
          style={{ display: "flex", gap: "0.5rem", padding: "0 1.125rem 0.875rem", marginTop: "-0.25rem" }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => { e.stopPropagation(); router.push(`/editar-reflexao/${reflexao.id}`); }}
            className="post-btn-edit"
            style={{ fontSize: "0.78rem", padding: "5px 12px" }}
          >
            ✏ Editar
          </button>
          <button
            onClick={handleDeletar}
            className="post-btn-delete"
            style={{ fontSize: "0.78rem", padding: "5px 12px" }}
          >
            🗑 Apagar
          </button>
        </div>
      )}
    </div>
  );
}

/* ── PerfilPublico ───────────────────────────────────── */

export default function PerfilPublico() {
  const { id } = useParams();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [series, setSeries] = useState<any[]>([]);
  const [reflexoes, setReflexoes] = useState<Reflexao[]>([]);
  const [aba, setAba] = useState<"posts" | "series" | "reflexoes">("posts");
  const [loading, setLoading] = useState(true);
  const [visitorUid, setVisitorUid] = useState<string | null>(null);

  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    setToastMsg(msg);
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2200);
  }

  useEffect(() => {
    setVisitorUid(auth.currentUser?.uid ?? null);
  }, []);

  useEffect(() => {
    async function carregar() {
      if (!id) return;
      try {
        const resultado = await resolverUid(id as string);
        if (!resultado) { setLoading(false); return; }

        setUser(resultado.userData);
        setUid(resultado.uid);

        if (resultado.userData.slug && resultado.userData.slug !== id) {
          router.replace(`/perfil/${resultado.userData.slug}`);
        }

        const [postsSnap, seriesSnap, reflexoesData] = await Promise.all([
          getDocs(query(
            collection(db, "posts"),
            where("autorId", "==", resultado.uid),
            where("tipo", "in", ["sermao", "artigo"]),
            orderBy("data", "desc")
          )),
          getDocs(query(
            collection(db, "series"),
            where("autorId", "==", resultado.uid),
            orderBy("criadoEm", "desc")
          )),
          getReflexoesPorAutor(resultado.uid),
        ]);

        const listaP: any[] = [];
        postsSnap.forEach((d) => listaP.push({ id: d.id, ...d.data() }));
        setPosts(listaP);

        const listaS: any[] = [];
        seriesSnap.forEach((d) => listaS.push({ id: d.id, ...d.data() }));
        setSeries(listaS);

        setReflexoes(reflexoesData);
      } catch (err) { console.error(err); }
      setLoading(false);
    }
    carregar();
  }, [id]);

  if (loading) return <div className="post-detail-loading"><div className="spinner" />Carregando perfil...</div>;
  if (!user) return <div className="post-detail-notfound">Usuário não encontrado.</div>;

  const nomeExibicao =
    user.titulo && user.nome
      ? `${user.titulo} ${user.nome}`
      : user.nome || "Usuário";

  const isOwner = !!visitorUid && visitorUid === uid;

  return (
    <>
      <Toast msg={toastMsg} visible={toastVisible} />

      <div className="perfil-wrapper">
        <div className="perfil-card">
          <Avatar src={user.fotoUrl} name={nomeExibicao} size={64} />
          <div className="perfil-info">
            <h1 className="perfil-nome">{nomeExibicao}</h1>
            {user.bio ? <p className="perfil-bio">{user.bio}</p> : <p className="perfil-bio-vazia">Sem descrição.</p>}
            <div style={{ display: "flex", gap: "1.25rem" }}>
              <div className="perfil-stat">
                <span className="perfil-stat-num">{posts.length}</span>
                <span className="perfil-stat-label">publicações</span>
              </div>
              <div className="perfil-stat">
                <span className="perfil-stat-num">{series.length}</span>
                <span className="perfil-stat-label">série{series.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="perfil-stat">
                <span className="perfil-stat-num">{reflexoes.length}</span>
                <span className="perfil-stat-label">reflexões</span>
              </div>
            </div>
          </div>
          {isOwner && (
            <div style={{ alignSelf: "flex-start" }}>
              <button className="post-btn-edit" onClick={() => router.push("/perfil")}>
                ✏ Editar perfil
              </button>
            </div>
          )}
        </div>

        <div className="perfil-posts-section">
          <div style={{ display: "flex", gap: "0", borderBottom: "1px solid var(--border)", marginBottom: "1.5rem" }}>
            {(["posts", "series", "reflexoes"] as const).map((a) => (
              <button
                key={a}
                onClick={() => setAba(a)}
                style={{
                  padding: "0.625rem 1.25rem", fontSize: "0.875rem", fontWeight: 600,
                  background: "none", border: "none",
                  borderBottom: aba === a ? "2px solid var(--emerald)" : "2px solid transparent",
                  color: aba === a ? "var(--emerald)" : "var(--text-3)",
                  cursor: "pointer", transition: "all 0.15s", marginBottom: "-1px",
                }}
              >
                {a === "posts" && `Publicações (${posts.length})`}
                {a === "series" && `Séries (${series.length})`}
                {a === "reflexoes" && `Reflexões (${reflexoes.length})`}
              </button>
            ))}
          </div>

          {aba === "posts" && (
            <>
              {posts.length === 0 && <div className="empty-state">Nenhuma publicação ainda.</div>}
              {(() => {
                const filaPerfilAudio = posts
                  .filter((p) => !!p.audioUrl)
                  .map((p) => ({
                    id: p.id,
                    tipo: p.tipo,
                    titulo: p.titulo,
                    autorNome: p.autorNome || "Autor",
                    autorFoto: p.autorFoto ?? null,
                    slug: p.slug,
                    autorSlug: p.autorSlug,
                    audioUrl: p.audioUrl,
                  }));
                return (
                  <div className="posts-list">
                    {posts.map((post, i) => (
                      <PostCardPerfil
                        key={post.id}
                        post={post}
                        index={i}
                        user={user}
                        nomeExibicao={nomeExibicao}
                        autorUid={uid!}
                        isOwner={isOwner}
                        onToast={showToast}
                        filaAudio={filaPerfilAudio}
                      />
                    ))}
                  </div>
                );
              })()}
            </>
          )}

          {aba === "series" && (
            <>
              {series.length === 0 && (
                <div className="empty-state">Este autor ainda não criou nenhuma série.</div>
              )}
              <div className="posts-list">
                {series.map((serie, i) => (
                  <SerieCardPublico
                    key={serie.id} serie={serie} index={i}
                    isOwner={isOwner} onToast={showToast}
                  />
                ))}
              </div>
            </>
          )}

          {aba === "reflexoes" && (
            <>
              {reflexoes.length === 0 && (
                <div className="empty-state">Este autor ainda não criou nenhuma reflexão.</div>
              )}
              <div className="posts-list">
                {reflexoes.map((r, i) => (
                  <CardReflexaoComControles
                    key={r.id ?? i} reflexao={r} index={i}
                    isOwner={isOwner} onToast={showToast}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        .post-card-image { cursor: pointer; }
        .card-cover-wrapper {
          position: relative; width: 100%; max-height: 420px; min-height: 160px;
          overflow: hidden; border-radius: var(--radius-lg) var(--radius-lg) 0 0;
          background: #0d1310; display: flex; align-items: center; justify-content: center;
        }
        .card-cover-img { width: 100%; height: 100%; object-fit: contain; display: block; max-height: 420px; transition: transform 0.35s ease; }
        .post-card-image:hover .card-cover-img { transform: scale(1.025); }
        .serie-card:hover .card-cover-img { transform: scale(1.025); }
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