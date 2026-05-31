"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { auth, db, storage } from "@/lib/firebase";
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
  arrayUnion,
  arrayRemove,
  increment,
  deleteDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useRouter } from "next/navigation";
import { slugify } from "@/lib/slugify";
import { gerarPDF } from "@/lib/gerarPDF";
import { getReflexoesPorAutor } from "@/lib/reflexoes";
import type { Reflexao } from "@/lib/reflexoes";
import BotaoGerarReflexoes from "@/components/reflexoes/BotaoGerarReflexoes";
import CardReflexao from "@/components/reflexoes/CardReflexao";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useTTS } from "@/hooks/useTTS";
import BannerLogin from "@/components/BannerLogin";
import dynamic from "next/dynamic";

const CommentSection = dynamic(
  () => import("@/components/comments/CommentSection"),
  { ssr: false, loading: () => null }
);

const FALLBACK_AUDIO = "https://archive.org/download/testmp3testfile/mpthreetest.mp3";

/* ── gerarSlugUnico ─────────────────────────────────── */

async function gerarSlugUnico(base: string, uidAtual: string): Promise<string> {
  const baseSlug = slugify(base);
  let candidato = baseSlug;
  let contador = 1;
  while (true) {
    const q = query(collection(db, "users"), where("slug", "==", candidato));
    const snap = await getDocs(q);
    if (snap.empty || (snap.size === 1 && snap.docs[0].id === uidAtual))
      return candidato;
    contador += 1;
    candidato = `${baseSlug}-${contador}`;
  }
}

/* ── Helpers ────────────────────────────────────────── */

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

/* ── Avatar ─────────────────────────────────────────── */

function Avatar({ src, name, size = 64 }: { src?: string | null; name: string; size?: number }) {
  const base: React.CSSProperties = {
    width: size, height: size, borderRadius: "50%", flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
  };
  if (src) {
    return <img src={src} alt={name} style={{ ...base, objectFit: "cover", boxShadow: "0 0 0 3px var(--emerald-dim)" }} />;
  }
  return (
    <div style={{
      ...base,
      background: "linear-gradient(135deg, var(--emerald-dark), var(--emerald))",
      color: "#fff", fontSize: Math.round(size * 0.36) + "px", fontWeight: 700,
      letterSpacing: "-0.01em",
      boxShadow: size >= 56 ? "0 0 0 3px var(--emerald-dim)" : "none",
      userSelect: "none",
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

// ─── BotaoOuvirSerieCard ──────────────────────────────────────────────────────
//
// Problema 2: resolve o TTS de cada post da série antes de montar a fila.

function BotaoOuvirSerieCard({ serie, onLoginRequired }: { serie: any; onLoginRequired: () => void }) {
  const {
    playQueue,
    pause,
    resume,
    isPlaying,
    isLoading: audioLoading,
    contextType,
    current: currentAudio,
  } = useAudioPlayer();

  const { resolveAudioUrl } = useTTS();

  const [carregandoPosts, setCarregandoPosts] = useState(false);
  const [postsCarregados, setPostsCarregados] = useState<any[] | null>(null);

  const serieAtiva =
    contextType === "serie" &&
    currentAudio !== null &&
    postsCarregados !== null &&
    postsCarregados.some((p: any) => p.id === currentAudio.id);

  const tocando = serieAtiva && isPlaying;
  const carregando = (serieAtiva && audioLoading) || carregandoPosts;

  async function buscarPostsDaSerie(): Promise<any[]> {
    if (postsCarregados !== null) return postsCarregados;
    const postIds: string[] = serie.postIds ?? [];
    if (postIds.length === 0) return [];
    const snaps = await Promise.all(postIds.map((id: string) => getDoc(doc(db, "posts", id))));
    const lista = snaps.filter((s) => s.exists()).map((s) => ({ id: s.id, ...s.data() }));
    setPostsCarregados(lista);
    return lista;
  }

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (!auth.currentUser) {
      onLoginRequired();
      return;
    }
    if (serieAtiva) {
      tocando ? pause() : resume();
      return;
    }
    setCarregandoPosts(true);
    try {
      const posts = await buscarPostsDaSerie();
      if (posts.length === 0) return;

      // ── Problema 2: resolve TTS para cada post antes de montar a fila ──
      const filaResolvida = await Promise.all(
        posts.map(async (p: any) => {
          let audioUrl = p.audioUrl && p.audioStatus === "ready" ? p.audioUrl : undefined;
          try {
            audioUrl = await resolveAudioUrl({
              postId: p.id,
              tipo: p.tipo === "artigo" ? "estudo" : p.tipo,
              titulo: p.titulo,
              audioUrlExistente: audioUrl,
            });
          } catch {
            audioUrl = audioUrl ?? FALLBACK_AUDIO;
          }
          return {
            id: p.id,
            tipo: p.tipo as "sermao" | "artigo" | "reflexao",
            titulo: p.titulo,
            autorNome: p.autorNome || "Autor",
            autorFoto: p.autorFoto ?? null,
            slug: p.slug,
            autorSlug: p.autorSlug,
            audioUrl,
          };
        })
      );

      const filaValida = filaResolvida.filter((p) => !!p.audioUrl && p.audioUrl !== FALLBACK_AUDIO);
      if (filaValida.length === 0) return;

      playQueue(filaValida[0], filaValida, "serie");
    } catch (err) {
      console.error("Erro ao carregar posts da série:", err);
    }
    setCarregandoPosts(false);
  }

  if (!serie.postIds || serie.postIds.length === 0) return null;

  return (
    <button
      onClick={handleClick}
      title={tocando ? "Pausar série" : serieAtiva ? "Continuar série" : "Ouvir série completa"}
      style={{
        display: "inline-flex", alignItems: "center", gap: "4px",
        padding: "4px 8px", borderRadius: "var(--radius-full)", border: "1px solid",
        borderColor: serieAtiva ? "var(--emerald-dim)" : "transparent",
        background: serieAtiva ? "var(--emerald-dim)" : "transparent",
        color: serieAtiva ? "var(--emerald)" : "var(--text-3)",
        fontSize: "0.72rem", fontWeight: 600, cursor: "pointer",
        transition: "all 0.15s", fontFamily: "inherit", flexShrink: 0,
        boxShadow: tocando ? "0 0 0 2px var(--emerald-dim)" : "none",
      }}
    >
      {carregando ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      ) : tocando ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v14l11-7-11-7z" /></svg>
      )}
      <span>{carregando ? "Gerando áudios…" : tocando ? "Pausar" : serieAtiva ? "Continuar" : "Ouvir série"}</span>
      {tocando && <span style={{ fontSize: "0.65rem", fontStyle: "italic", opacity: 0.7 }}>· agora</span>}
    </button>
  );
}

// ─── BotaoOuvirPerfil ─────────────────────────────────────────────────────────

function BotaoOuvirPerfil({
  post,
  filaAudio = [],
  onLoginRequired,
}: {
  post: any;
  filaAudio?: any[];
  onLoginRequired: () => void;
}) {
  const { playQueue, playOrToggle, isCurrentlyPlaying, isCurrentPublication, isLoading: audioLoading } = useAudioPlayer();
  const { resolveAudioUrl, isGenerating: ttsGenerating, error: ttsError } = useTTS();

  const audioAtivo = isCurrentPublication(post.id);
  const audioTocando = isCurrentlyPlaying(post.id);
  const audioCarregando = audioAtivo && audioLoading;
  const ocupado = ttsGenerating || audioCarregando;

  const label =
    ttsGenerating   ? "Gerando…"         :
    audioCarregando ? "Carregando…"      :
    ttsError        ? "Tentar novamente" :
    audioTocando    ? "Pausar"           :
    audioAtivo      ? "Continuar"        :
    "Ouvir";

  const btnColor       = ttsError ? "var(--red, #ef4444)"     : audioAtivo ? "var(--emerald)"     : "var(--text-3)";
  const btnBorderColor = ttsError ? "var(--red-dim, #fecaca)" : audioAtivo ? "var(--emerald-dim)" : "transparent";
  const btnBg          = ttsError ? "var(--red-dim, #fef2f2)" : audioAtivo ? "var(--emerald-dim)" : "transparent";

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (!auth.currentUser) {
      onLoginRequired();
      return;
    }
    try {
      const audioUrl = await resolveAudioUrl({
        postId: post.id,
        tipo: post.tipo === "artigo" ? "estudo" : post.tipo,
        titulo: post.titulo,
        audioUrlExistente: post.audioUrl && post.audioStatus === "ready" ? post.audioUrl : undefined,
      });
      const pub = {
        id: post.id,
        tipo: post.tipo,
        titulo: post.titulo,
        autorNome: post.autorNome || "Autor",
        autorFoto: post.autorFoto ?? null,
        slug: post.slug,
        autorSlug: post.autorSlug,
        audioUrl,
      };
      if (filaAudio.length > 0) {
        const filaAtualizada = filaAudio.map((item) =>
          item.id === post.id ? { ...item, audioUrl } : item
        );
        playQueue(pub, filaAtualizada, "perfil");
      } else {
        playOrToggle(pub);
      }
    } catch {
      // ttsError já setado pelo hook
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={ocupado}
      title={ttsError ? "Clique para tentar novamente" : audioTocando ? "Pausar" : "Ouvir este conteúdo"}
      style={{
        display: "inline-flex", alignItems: "center", gap: "4px",
        padding: "4px 8px", borderRadius: "var(--radius-full)", border: "1px solid",
        borderColor: btnBorderColor,
        background: btnBg,
        color: btnColor,
        fontSize: "0.72rem", fontWeight: 600,
        cursor: ocupado ? "default" : "pointer",
        opacity: ocupado ? 0.7 : 1,
        transition: "all 0.15s", fontFamily: "inherit", flexShrink: 0,
        boxShadow: audioTocando ? "0 0 0 2px var(--emerald-dim)" : "none",
      }}
    >
      {ttsGenerating ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
      ) : ttsError ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      ) : audioTocando ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v14l11-7-11-7z"/></svg>
      )}
      <span>{label}</span>
      {audioTocando && <span style={{ fontSize: "0.65rem", fontStyle: "italic", opacity: 0.7 }}>· agora</span>}
    </button>
  );
}

// ─── CardReflexaoComOuvir ─────────────────────────────────────────────────────

function CardReflexaoComOuvir({
  reflexao,
  filaAudio = [],
  onLoginRequired,
}: {
  reflexao: Reflexao;
  filaAudio?: any[];
  onLoginRequired: () => void;
}) {
  const { playQueue, playOrToggle, isCurrentlyPlaying, isCurrentPublication, isLoading: audioLoading } = useAudioPlayer();
  const { resolveAudioUrl, isGenerating: ttsGenerating, error: ttsError } = useTTS();

  const audioAtivo = isCurrentPublication(reflexao.id ?? "");
  const audioTocando = isCurrentlyPlaying(reflexao.id ?? "");
  const audioCarregando = audioAtivo && audioLoading;
  const ocupado = ttsGenerating || audioCarregando;

  const label =
    ttsGenerating   ? "Gerando…"         :
    audioCarregando ? "Carregando…"      :
    ttsError        ? "Tentar novamente" :
    audioTocando    ? "Pausar"           :
    audioAtivo      ? "Continuar"        :
    "Ouvir";

  const btnColor       = ttsError ? "var(--red, #ef4444)"     : audioAtivo ? "var(--emerald)"     : "var(--text-3)";
  const btnBorderColor = ttsError ? "var(--red-dim, #fecaca)" : audioAtivo ? "var(--emerald-dim)" : "transparent";
  const btnBg          = ttsError ? "var(--red-dim, #fef2f2)" : audioAtivo ? "var(--emerald-dim)" : "transparent";

  async function handleOuvir(e: React.MouseEvent) {
    e.stopPropagation();
    if (!auth.currentUser) {
      onLoginRequired();
      return;
    }
    if (!reflexao.id) return;
    try {
      const audioUrl = await resolveAudioUrl({
        postId: reflexao.id,
        tipo: "reflexao",
        titulo: reflexao.titulo,
        audioUrlExistente: (reflexao as any).audioUrl && (reflexao as any).audioStatus === "ready"
          ? (reflexao as any).audioUrl
          : undefined,
      });
      const pub = {
        id: reflexao.id,
        tipo: "reflexao" as const,
        titulo: reflexao.titulo,
        autorNome: reflexao.autorNome,
        autorFoto: null,
        slug: reflexao.slug,
        autorSlug: reflexao.autorSlug,
        audioUrl,
      };
      if (filaAudio.length > 0) {
        const filaAtualizada = filaAudio.map((item) =>
          item.id === reflexao.id ? { ...item, audioUrl } : item
        );
        playQueue(pub, filaAtualizada, "perfil");
      } else {
        playOrToggle(pub);
      }
    } catch {
      // ttsError já setado pelo hook
    }
  }

  return (
    <CardReflexao
      reflexao={reflexao}
      botaoOuvir={
        <button
          onClick={handleOuvir}
          disabled={ocupado}
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.3rem",
            padding: "4px 10px", borderRadius: "var(--radius-full)", border: "1px solid",
            borderColor: btnBorderColor,
            background: btnBg,
            color: btnColor,
            fontSize: "0.75rem", fontWeight: 600,
            cursor: ocupado ? "default" : "pointer",
            opacity: ocupado ? 0.7 : 1,
            transition: "all 0.18s ease", fontFamily: "inherit",
          }}
        >
          {ttsGenerating ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
          ) : ttsError ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          ) : audioTocando ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v14l11-7-11-7z"/></svg>
          )}
          <span>{label}</span>
        </button>
      }
    />
  );
}

/* ── SerieCardMeuPerfil ─────────────────────────────── */

function SerieCardMeuPerfil({
  serie, index, onToast,
}: {
  serie: any; index: number; onToast: (msg: string) => void;
}) {
  const router = useRouter();
  const postCount = serie.postIds?.length ?? 0;
  const currentPath = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/perfil";
  const [showLoginBanner, setShowLoginBanner] = useState(false);

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
          <div style={{ padding: "0 1.125rem 0.625rem" }} onClick={(e) => e.stopPropagation()}>
            <BannerLogin onClose={() => setShowLoginBanner(false)} redirectTo={currentPath} />
          </div>
        )}
        <div className="card-footer-row" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          onClick={(e) => e.stopPropagation()}>
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
          <BotaoOuvirSerieCard
            serie={serie}
            onLoginRequired={() => setShowLoginBanner(true)}
          />
          <span className="read-link" style={{ marginLeft: "auto" }}
            onClick={() => router.push(`/series/${serie.slug}`)}>
            Ver série →
          </span>
        </div>
      </div>
    </article>
  );
}

/* ── PostCardMeuPerfil ──────────────────────────────── */

function PostCardMeuPerfil({
  post, index, fotoUrl, nomeExibicao, onToast, filaAudio = [],
}: {
  post: any; index: number; fotoUrl: string | null;
  nomeExibicao: string; onToast: (msg: string) => void;
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

  const postPath = `/posts/${post.tipo === "sermao" ? "sermoes" : "estudos"}/${post.slug}?from=perfil`;
  const fullUrl = typeof window !== "undefined"
    ? `${window.location.origin}/posts/${post.tipo === "sermao" ? "sermoes" : "estudos"}/${post.slug}`
    : `/posts/${post.tipo === "sermao" ? "sermoes" : "estudos"}/${post.slug}`;

  const currentPath = typeof window !== "undefined"
    ? window.location.pathname + window.location.search
    : "/perfil";

  function buildFrase() {
    const data = formatData(post.data);
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
    if (!currentUid) { setShowLoginBanner(true); return; }
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
        fotoAutor: fotoUrl ?? null, dataPost: formatData(post.data),
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
    <div className="card-footer-row" style={{ display: "flex", alignItems: "center", gap: "0" }}
      onClick={(e) => e.stopPropagation()}>
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
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
            if (!currentUid) { setShowLoginBanner(true); return; }
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

        <BotaoOuvirPerfil
          post={post}
          filaAudio={filaAudio}
          onLoginRequired={() => setShowLoginBanner(true)}
        />
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
            <Avatar src={fotoUrl} name={nomeExibicao} size={28} />
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
              <BannerLogin onClose={() => setShowLoginBanner(false)} redirectTo={currentPath} />
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
        <Avatar src={fotoUrl} name={nomeExibicao} size={36} />
        <div className="author-col" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <span className="author-name-link" style={{ display: "inline", width: "fit-content", alignSelf: "flex-start", cursor: "default" }}>
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
          <BannerLogin onClose={() => setShowLoginBanner(false)} redirectTo={currentPath} />
        </div>
      )}
      {footerRow}
      {commentsPanel}
    </article>
  );
}

/* ── Perfil (meu perfil) ────────────────────────────── */

function PerfilContent() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [nome, setNome] = useState("");
  const [titulo, setTitulo] = useState("");
  const [bio, setBio] = useState("");
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [autorSlug, setAutorSlug] = useState("");

  const [editando, setEditando] = useState(false);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [uploadandoFoto, setUploadandoFoto] = useState(false);

  const [rascNome, setRascNome] = useState("");
  const [rascTitulo, setRascTitulo] = useState("");
  const [rascBio, setRascBio] = useState("");
  const [rascFotoPreview, setRascFotoPreview] = useState<string | null>(null);
  const [rascFotoFile, setRascFotoFile] = useState<File | null>(null);

  const [posts, setPosts] = useState<any[]>([]);
  const [series, setSeries] = useState<any[]>([]);
  const [reflexoes, setReflexoes] = useState<Reflexao[]>([]);
  const searchParams = useSearchParams();
  const [aba, setAba] = useState<"posts" | "series" | "reflexoes">(() => {
    const abaParam = searchParams.get("aba");
    if (abaParam === "reflexoes" || abaParam === "series") return abaParam;
    return "posts";
  });

  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    setToastMsg(msg);
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2200);
  }

  async function carregar() {
    const user = auth.currentUser;
    if (!user) return;
    setUid(user.uid);
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const d = snap.data();
        setNome(d.nome || "");
        setTitulo(d.titulo || "");
        setBio(d.bio || "");
        setFotoUrl(d.fotoUrl || null);
        setAutorSlug(d.slug || "");
      } else {
        setNome(user.displayName || "");
        setFotoUrl(user.photoURL || null);
      }

      const [postsSnap, seriesSnap, reflexoesData] = await Promise.all([
        getDocs(query(
          collection(db, "posts"),
          where("autorId", "==", user.uid),
          where("tipo", "in", ["sermao", "artigo"]),
          orderBy("data", "desc")
        )),
        getDocs(query(
          collection(db, "series"),
          where("autorId", "==", user.uid),
          orderBy("criadoEm", "desc")
        )),
        getReflexoesPorAutor(user.uid),
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

  useEffect(() => { carregar(); }, []);

  useEffect(() => {
    if (aba === "reflexoes" && uid) {
      getReflexoesPorAutor(uid).then(setReflexoes).catch(console.error);
    }
  }, [aba, uid]);

  useEffect(() => {
    if (aba === "series" && uid) {
      getDocs(query(
        collection(db, "series"),
        where("autorId", "==", uid),
        orderBy("criadoEm", "desc")
      )).then((snap) => {
        const lista: any[] = [];
        snap.forEach((d) => lista.push({ id: d.id, ...d.data() }));
        setSeries(lista);
      }).catch(console.error);
    }
  }, [aba, uid]);

  function abrirEdicao() {
    setRascNome(nome);
    setRascTitulo(titulo);
    setRascBio(bio);
    setRascFotoPreview(fotoUrl);
    setRascFotoFile(null);
    setEditando(true);
  }

  function onEscolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRascFotoFile(file);
    setRascFotoPreview(URL.createObjectURL(file));
  }

  async function salvar() {
    const user = auth.currentUser;
    if (!user) return;
    if (!rascNome.trim()) { alert("O nome é obrigatório."); return; }
    setSalvando(true);
    try {
      let novaFotoUrl = fotoUrl;
      if (rascFotoFile) {
        setUploadandoFoto(true);
        const storageRef = ref(storage, `avatars/${user.uid}`);
        await uploadBytes(storageRef, rascFotoFile);
        novaFotoUrl = await getDownloadURL(storageRef);
        setUploadandoFoto(false);
      }
      const nomeCompleto = rascTitulo.trim()
        ? `${rascTitulo.trim()} ${rascNome.trim()}`
        : rascNome.trim();
      const slug = await gerarSlugUnico(nomeCompleto, user.uid);
      await updateDoc(doc(db, "users", user.uid), {
        nome: rascNome, titulo: rascTitulo, bio: rascBio,
        fotoUrl: novaFotoUrl, slug,
      });
      await updateProfile(user, {
        displayName: rascNome, photoURL: novaFotoUrl ?? undefined,
      });
      const [postsSnap, seriesSnap] = await Promise.all([
        getDocs(query(collection(db, "posts"), where("autorId", "==", user.uid))),
        getDocs(query(collection(db, "series"), where("autorId", "==", user.uid))),
      ]);
      const batch = writeBatch(db);
      postsSnap.forEach((postDoc) => {
        batch.update(postDoc.ref, { autorNome: nomeCompleto, autorFoto: novaFotoUrl });
      });
      seriesSnap.forEach((serieDoc) => {
        batch.update(serieDoc.ref, { autorNome: nomeCompleto, autorFoto: novaFotoUrl });
      });
      await batch.commit();
      await carregar();
      setEditando(false);
    } catch (err) { console.error(err); alert("Erro ao salvar perfil."); }
    setSalvando(false);
  }

  if (loading) return <div className="post-detail-loading"><div className="spinner" />Carregando perfil...</div>;

  const nomeExibicao = titulo.trim() ? `${titulo.trim()} ${nome.trim()}` : nome.trim() || "Usuário";
  const rascNomeExibicao = rascTitulo.trim() ? `${rascTitulo.trim()} ${rascNome.trim()}` : rascNome.trim() || "Seu nome";

  const filaPerfilAudio = posts.map((p) => ({
    id: p.id,
    tipo: p.tipo,
    titulo: p.titulo,
    autorNome: p.autorNome || "Autor",
    autorFoto: p.autorFoto ?? null,
    slug: p.slug,
    autorSlug: p.autorSlug,
    audioUrl: p.audioUrl || FALLBACK_AUDIO,
  }));

  const filaReflexoesAudio = reflexoes
    .filter((r) => !!r.id)
    .map((r) => ({
      id: r.id!,
      tipo: "reflexao" as const,
      titulo: r.titulo,
      autorNome: r.autorNome || "Autor",
      autorFoto: null,
      slug: r.slug,
      autorSlug: r.autorSlug,
      audioUrl: FALLBACK_AUDIO,
    }));

  return (
    <>
      <Toast msg={toastMsg} visible={toastVisible} />

      <div className="perfil-wrapper">

        {/* MODO VISUALIZAÇÃO */}
        {!editando && (
          <div className="perfil-card">
            <Avatar src={fotoUrl} name={nomeExibicao} size={64} />
            <div className="perfil-info" style={{ flex: 1 }}>
              <h1 className="perfil-nome">{nomeExibicao}</h1>
              {bio ? <p className="perfil-bio">{bio}</p> : <p className="perfil-bio-vazia">Sem descrição.</p>}
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
            <div style={{ alignSelf: "flex-start" }}>
              <button className="post-btn-edit" onClick={abrirEdicao}>✏ Editar perfil</button>
            </div>
          </div>
        )}

        {/* MODO EDIÇÃO */}
        {editando && (
          <div className="perfil-card" style={{ flexDirection: "column", gap: "1.75rem", alignItems: "stretch" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.875rem" }}>
              <div onClick={() => fileInputRef.current?.click()} title="Clique para trocar a foto" style={{ position: "relative", cursor: "pointer" }}>
                <Avatar src={rascFotoPreview} name={rascNomeExibicao} size={96} />
                <div
                  style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.18s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}
                >
                  <span style={{ fontSize: "1.5rem" }}>📷</span>
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onEscolherFoto} />
              <div style={{ textAlign: "center" }}>
                <p className="perfil-nome" style={{ fontSize: "1.1rem", marginBottom: "0.2rem" }}>{rascNomeExibicao}</p>
                <p style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>Clique na foto para trocar · JPG, PNG ou WebP · máx. 2 MB</p>
              </div>
            </div>

            <div style={{ height: "1px", background: "var(--border)", margin: "0 -2rem" }} />

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "0.75rem" }}>
                <div className="auth-field">
                  <label className="auth-label">Título <span className="auth-label-opt">(opcional)</span></label>
                  <input className="auth-input" placeholder="Pastor, Pr., Rev..." value={rascTitulo} onChange={(e) => setRascTitulo(e.target.value)} />
                </div>
                <div className="auth-field">
                  <label className="auth-label">Nome</label>
                  <input className="auth-input" placeholder="Seu nome completo" value={rascNome} onChange={(e) => setRascNome(e.target.value)} />
                </div>
              </div>
              <div className="auth-field">
                <label className="auth-label">Sobre você <span className="auth-label-opt">(opcional)</span></label>
                <textarea className="auth-input" style={{ minHeight: "6rem", resize: "vertical", lineHeight: 1.65 }} placeholder="Conte sobre sua história, ministério ou motivação..." value={rascBio} onChange={(e) => setRascBio(e.target.value)} />
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button onClick={salvar} disabled={salvando} className="auth-btn-primary" style={{ flex: 1 }}>
                {uploadandoFoto ? "Enviando foto..." : salvando ? "Salvando..." : "Salvar alterações"}
              </button>
              <button onClick={() => setEditando(false)} disabled={salvando} className="post-btn-delete" style={{ padding: "11px 20px", borderRadius: "var(--radius-full)", fontSize: "0.85rem" }}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* ABAS */}
        <div className="perfil-posts-section">
          <div style={{ display: "flex", gap: "0", borderBottom: "1px solid var(--border)", marginBottom: "1.5rem" }}>
            {(["posts", "series", "reflexoes"] as const).map((a) => (
              <button
                key={a}
                onClick={() => setAba(a)}
                style={{
                  padding: "0.625rem 1.25rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  background: "none",
                  border: "none",
                  borderBottom: aba === a ? "2px solid var(--emerald)" : "2px solid transparent",
                  color: aba === a ? "var(--emerald)" : "var(--text-3)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  marginBottom: "-1px",
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
              {posts.length === 0 && (
                <div className="empty-state">Você ainda não publicou nada.</div>
              )}
              <div className="posts-list">
                {posts.map((post, i) => (
                  <PostCardMeuPerfil
                    key={post.id}
                    post={post}
                    index={i}
                    fotoUrl={fotoUrl}
                    nomeExibicao={nomeExibicao}
                    onToast={showToast}
                    filaAudio={filaPerfilAudio}
                  />
                ))}
              </div>
            </>
          )}

          {aba === "series" && (
            <>
              {series.length === 0 ? (
                <div className="empty-state">
                  Você ainda não criou nenhuma série.{" "}
                  <span
                    style={{ color: "var(--emerald)", cursor: "pointer", textDecoration: "underline" }}
                    onClick={() => router.push("/criar-serie")}
                  >
                    Criar primeira série
                  </span>
                </div>
              ) : (
                <div className="posts-list">
                  {series.map((serie, i) => (
                    <SerieCardMeuPerfil
                      key={serie.id}
                      serie={serie}
                      index={i}
                      onToast={showToast}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {aba === "reflexoes" && (
            <>
              <div style={{ marginBottom: "1.25rem" }}>
                {uid && autorSlug && (
                  <BotaoGerarReflexoes
                    autorId={uid}
                    autorNome={nomeExibicao}
                    autorSlug={autorSlug}
                  />
                )}
              </div>

              {reflexoes.length === 0 ? (
                <div className="empty-state">
                  Você ainda não criou nenhuma reflexão. Clique em "Criar Reflexões" para começar.
                </div>
              ) : (
                <div className="posts-list">
                  {reflexoes.map((r, i) => (
                    <CardReflexaoComOuvir
                      key={r.id ?? i}
                      reflexao={r}
                      filaAudio={filaReflexoesAudio}
                      onLoginRequired={() => {}}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
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
        .serie-card:hover .card-cover-img { transform: scale(1.025); }
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

export default function Perfil() {
  return (
    <Suspense fallback={<div className="post-detail-loading"><div className="spinner" />Carregando...</div>}>
      <PerfilContent />
    </Suspense>
  );
}