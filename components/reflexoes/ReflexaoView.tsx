"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import {
  doc,
  deleteDoc,
  runTransaction,
  arrayUnion,
  arrayRemove,
  increment,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import type { Reflexao } from "@/lib/reflexoes";
import CompartilharWhatsapp from "@/components/reflexoes/CompartilharWhatsapp";
import BannerLogin from "@/components/BannerLogin";
import dynamic from "next/dynamic";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useAudioSync } from "@/hooks/useAudioSync";
import { useTTS } from "@/hooks/useTTS";
import type { AudioPublication } from "@/providers/AudioProvider";
import { FALLBACK_AUDIO } from "@/lib/audioQueue";

const CommentSection = dynamic(
  () => import("@/components/comments/CommentSection"),
  { ssr: false, loading: () => null }
);

// ── Ícones ────────────────────────────────────────────────────────────────────

function IconHeart({ size = 16, filled = false }: { size?: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path
        d="M8 13.5C8 13.5 1.5 9.5 1.5 5.5C1.5 3.567 3.067 2 5 2C6.105 2 7.093 2.535 7.75 3.366L8 3.7L8.25 3.366C8.907 2.535 9.895 2 11 2C12.933 2 14.5 3.567 14.5 5.5C14.5 9.5 8 13.5 8 13.5Z"
        stroke="currentColor" strokeWidth="1.4" fill={filled ? "currentColor" : "none"}
        strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

function IconComment({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path
        d="M2 3.5A1.5 1.5 0 0 1 3.5 2h9A1.5 1.5 0 0 1 14 3.5v6A1.5 1.5 0 0 1 12.5 11H9l-3 3v-3H3.5A1.5 1.5 0 0 1 2 9.5v-6Z"
        stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" fill="none"
      />
    </svg>
  );
}

function IconArrowLeft({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M7.5 2L3.5 6l4 4" stroke="currentColor" strokeWidth="1.4"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconArrowRight({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M4.5 2L8.5 6l-4 4" stroke="currentColor" strokeWidth="1.4"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Avatar pequeno para nav ───────────────────────────────────────────────────

function NavAvatar({ src, name, size = 22 }: { src?: string | null; name: string; size?: number }) {
  if (src) {
    return (
      <img src={src} alt={name} style={{
        width: size, height: size, borderRadius: "50%",
        objectFit: "cover", flexShrink: 0,
      }} />
    );
  }
  const initials = name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "linear-gradient(135deg, var(--emerald-dark), var(--emerald))",
      color: "#fff", fontSize: Math.round(size * 0.4) + "px", fontWeight: 700,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

// ── helpers de feed global ────────────────────────────────────────────────────

function getDataValor(item: any): number {
  if (!item) return 0;
  const d = item.criadoEm || item.data;
  if (!d) return 0;
  if (d?.toDate) return d.toDate().getTime();
  if (typeof d === "string") return new Date(d).getTime();
  return 0;
}

type FeedNavItem = {
  id: string;
  _feedType: "post" | "serie" | "reflexao";
  titulo: string;
  slug?: string;
  tipo?: string;
  autorId?: string;
  autorNome?: string;
  autorSlug?: string;
};

async function fetchFeedGlobal(): Promise<FeedNavItem[]> {
  const [postsSnap, seriesSnap, reflexoesSnap] = await Promise.all([
    getDocs(query(collection(db, "posts"), where("tipo", "in", ["sermao", "artigo"]), orderBy("data", "desc"))),
    getDocs(query(collection(db, "series"), orderBy("criadoEm", "desc"))),
    getDocs(query(collection(db, "posts"), where("tipo", "==", "reflexao"), orderBy("criadoEm", "desc"))),
  ]);

  const posts: FeedNavItem[] = [];
  postsSnap.forEach((d) => posts.push({ id: d.id, _feedType: "post", ...d.data() } as FeedNavItem));

  const series: FeedNavItem[] = [];
  seriesSnap.forEach((d) => series.push({ id: d.id, _feedType: "serie", ...d.data() } as FeedNavItem));

  const reflexoes: FeedNavItem[] = [];
  reflexoesSnap.forEach((d) => reflexoes.push({ id: d.id, _feedType: "reflexao", ...d.data() } as FeedNavItem));

  return [...posts, ...series, ...reflexoes].sort(
    (a, b) => getDataValor(b) - getDataValor(a)
  );
}

function feedItemUrl(item: FeedNavItem): string {
  if (item._feedType === "serie") return `/series/${item.slug ?? item.id}?from=home`;
  if (item._feedType === "reflexao") {
    const aSlug = item.autorSlug ?? item.autorId ?? "";
    return `/${aSlug}/reflexao/${item.slug ?? item.id}?from=home`;
  }
  const cat = item.tipo === "sermao" ? "sermoes" : "estudos";
  return `/posts/${cat}/${item.slug ?? item.id}?from=home`;
}

function feedItemLabel(item: FeedNavItem, direction: "prev" | "next"): string {
  const prefix = direction === "prev" ? "Anterior" : "Próximo";
  if (item._feedType === "serie") return `${prefix}: série`;
  if (item._feedType === "reflexao") return `Reflexão ${direction === "prev" ? "anterior" : "próxima"}`;
  if (item.tipo === "sermao") return `Sermão ${direction === "prev" ? "anterior" : "próximo"}`;
  return `Estudo ${direction === "prev" ? "anterior" : "próximo"}`;
}

// ── Tipos de navegação ────────────────────────────────────────────────────────

type ReflexaoNav = {
  id: string;
  titulo: string;
  slug: string;
  autorSlug: string;
  autorNome: string;
  autorFoto: string | null;
};

type NavAutor = { nome: string; fotoUrl: string | null };

// ── ReflexaoNavigation ────────────────────────────────────────────────────────

function ReflexaoNavigation({
  reflexaoId,
  autorId,
  autorSlugAtual,
  onPlayQueueItem,
}: {
  reflexaoId: string;
  autorId: string;
  autorSlugAtual: string;
  onPlayQueueItem: (pub: AudioPublication) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromHome = searchParams.get("from") === "home";

  const [prev, setPrev] = useState<FeedNavItem | ReflexaoNav | null>(null);
  const [next, setNext] = useState<FeedNavItem | ReflexaoNav | null>(null);
  const [prevAutor, setPrevAutor] = useState<NavAutor | null>(null);
  const [nextAutor, setNextAutor] = useState<NavAutor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchNav() {
      try {
        if (fromHome) {
          const all = await fetchFeedGlobal();
          const idx = all.findIndex((item) => item.id === reflexaoId);
          if (idx === -1) { setLoading(false); return; }

          const p = idx - 1 >= 0         ? all[idx - 1] : null;
          const n = idx + 1 < all.length ? all[idx + 1] : null;
          setPrev(p);
          setNext(n);

          async function autorFromFeedItem(item: FeedNavItem): Promise<NavAutor> {
            const aId = item.autorId;
            if (!aId) return { nome: item.autorNome || "Autor", fotoUrl: null };
            try {
              const snap = await getDoc(doc(db, "users", aId));
              if (snap.exists()) {
                const d = snap.data();
                return {
                  nome: d.titulo && d.nome
                    ? `${d.titulo.trim()} ${d.nome.trim()}`
                    : d.nome?.trim() || item.autorNome || "Autor",
                  fotoUrl: d.fotoUrl ?? null,
                };
              }
            } catch {}
            return { nome: item.autorNome || "Autor", fotoUrl: null };
          }

          const [pa, na] = await Promise.all([
            p ? autorFromFeedItem(p as FeedNavItem) : Promise.resolve(null),
            n ? autorFromFeedItem(n as FeedNavItem) : Promise.resolve(null),
          ]);
          setPrevAutor(pa);
          setNextAutor(na);
          setLoading(false);
          return;
        }

        // Modo B: reflexões do mesmo autor
        const autorSnap = await getDoc(doc(db, "users", autorId));
        let fotoUrl: string | null = null;
        let nomeCompleto = "";
        if (autorSnap.exists()) {
          const d = autorSnap.data();
          fotoUrl = d.fotoUrl ?? null;
          nomeCompleto =
            d.titulo && d.nome
              ? `${d.titulo.trim()} ${d.nome.trim()}`
              : d.nome?.trim() || "Autor";
        }

        const snap = await getDocs(
          query(
            collection(db, "posts"),
            where("autorId", "==", autorId),
            where("tipo", "==", "reflexao"),
            orderBy("criadoEm", "desc")
          )
        );

        const todas: ReflexaoNav[] = snap.docs.map((d) => ({
          id: d.id,
          titulo: d.data().titulo || "Sem título",
          slug: d.data().slug ?? d.id,
          autorSlug: d.data().autorSlug ?? autorSlugAtual,
          autorNome: nomeCompleto,
          autorFoto: fotoUrl,
        }));

        const idx = todas.findIndex((r) => r.id === reflexaoId);
        if (idx === -1) { setLoading(false); return; }

        const p = idx - 1 >= 0           ? todas[idx - 1] : null;
        const n = idx + 1 < todas.length ? todas[idx + 1] : null;
        setPrev(p);
        setNext(n);
        const navAutor: NavAutor = { nome: nomeCompleto, fotoUrl };
        if (p) setPrevAutor(navAutor);
        if (n) setNextAutor(navAutor);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    }
    fetchNav();
  }, [reflexaoId, autorId, autorSlugAtual, fromHome]);

  function navUrl(item: FeedNavItem | ReflexaoNav): string {
    if (fromHome) return feedItemUrl(item as FeedNavItem);
    const r = item as ReflexaoNav;
    return `/${r.autorSlug}/reflexao/${r.slug}?from=perfil`;
  }

  function navLabel(item: FeedNavItem | ReflexaoNav, direction: "prev" | "next"): string {
    if (fromHome) return feedItemLabel(item as FeedNavItem, direction);
    return direction === "prev" ? "Reflexão anterior" : "Próxima reflexão";
  }

  function handleNav(item: FeedNavItem | ReflexaoNav) {
    onPlayQueueItem({
      id: item.id,
      tipo: "reflexao",
      titulo: item.titulo,
      autorNome: (item as ReflexaoNav).autorNome ?? (item as FeedNavItem).autorNome ?? "Autor",
      autorFoto: (item as ReflexaoNav).autorFoto ?? null,
      slug: (item as ReflexaoNav).slug ?? (item as FeedNavItem).slug ?? item.id,
      autorSlug: (item as ReflexaoNav).autorSlug ?? (item as FeedNavItem).autorSlug,
      audioUrl: FALLBACK_AUDIO,
    });
    router.push(navUrl(item));
  }

  if (loading || (!prev && !next)) return null;

  const cardBase: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    padding: "0.875rem 1rem",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border-light)",
    borderRadius: "var(--radius-lg)",
    cursor: "pointer",
    transition: "border-color 0.15s, background 0.15s",
    minWidth: 0,
    fontFamily: "inherit",
  };

  const hasLeft  = !!prev;
  const hasRight = !!next;
  const gridClass = hasLeft && hasRight
    ? "reflexao-nav-grid--both"
    : hasLeft
    ? "reflexao-nav-grid--prev"
    : "reflexao-nav-grid--next";

  return (
    <div style={{ marginTop: "0.5rem" }}>
      <nav
        className={`reflexao-nav-grid ${gridClass}`}
        aria-label="Navegação entre publicações"
      >
        {prev ? (
          <button
            onClick={() => handleNav(prev)}
            aria-label={`Anterior: ${prev.titulo}`}
            style={{ ...cardBase, alignItems: "flex-start", textAlign: "left" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--emerald-dim)";
              e.currentTarget.style.background = "var(--bg-card)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border-light)";
              e.currentTarget.style.background = "var(--bg-elevated)";
            }}
          >
            <span style={{
              display: "flex", alignItems: "center", gap: "4px",
              fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.08em",
              textTransform: "uppercase", color: "var(--emerald)", opacity: 0.8,
            }}>
              <IconArrowLeft size={12} />
              {navLabel(prev, "prev")}
            </span>
            <span style={{
              fontSize: "0.85rem", fontWeight: 600, color: "var(--text-1)",
              lineHeight: 1.3, overflow: "hidden",
              display: "-webkit-box", WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical", wordBreak: "break-word",
            }}>
              {prev.titulo}
            </span>
            {prevAutor && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                <NavAvatar src={prevAutor.fotoUrl} name={prevAutor.nome} size={22} />
                <span style={{
                  fontSize: "0.72rem", color: "var(--text-3)",
                  fontStyle: "italic", overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {prevAutor.nome}
                </span>
              </div>
            )}
          </button>
        ) : (
          <span />
        )}

        {next ? (
          <button
            onClick={() => handleNav(next)}
            aria-label={`Próximo: ${next.titulo}`}
            style={{ ...cardBase, alignItems: "flex-end", textAlign: "right" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--emerald-dim)";
              e.currentTarget.style.background = "var(--bg-card)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border-light)";
              e.currentTarget.style.background = "var(--bg-elevated)";
            }}
          >
            <span style={{
              display: "flex", alignItems: "center", gap: "4px",
              fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.08em",
              textTransform: "uppercase", color: "var(--emerald)", opacity: 0.8,
            }}>
              {navLabel(next, "next")}
              <IconArrowRight size={12} />
            </span>
            <span style={{
              fontSize: "0.85rem", fontWeight: 600, color: "var(--text-1)",
              lineHeight: 1.3, overflow: "hidden",
              display: "-webkit-box", WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical", wordBreak: "break-word",
            }}>
              {next.titulo}
            </span>
            {nextAutor && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px", justifyContent: "flex-end" }}>
                <span style={{
                  fontSize: "0.72rem", color: "var(--text-3)",
                  fontStyle: "italic", overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {nextAutor.nome}
                </span>
                <NavAvatar src={nextAutor.fotoUrl} name={nextAutor.nome} size={22} />
              </div>
            )}
          </button>
        ) : (
          <span />
        )}
      </nav>

      <style>{`
        .reflexao-nav-grid {
          display: grid;
          gap: 0.75rem;
        }
        .reflexao-nav-grid--both { grid-template-columns: 1fr 1fr; }
        .reflexao-nav-grid--prev { grid-template-columns: 1fr auto; }
        .reflexao-nav-grid--next { grid-template-columns: auto 1fr; }
        @media (max-width: 480px) {
          .reflexao-nav-grid--both,
          .reflexao-nav-grid--prev,
          .reflexao-nav-grid--next { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

type Props = {
  reflexao: Reflexao;
  autorSlug: string;
};

export default function ReflexaoView({ reflexao, autorSlug }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromParam = searchParams.get("from") ?? "";

  const [isOwner, setIsOwner] = useState(false);
  const [deletando, setDeletando] = useState(false);

  const uid = auth.currentUser?.uid ?? null;
  const [likes, setLikes] = useState<number>(reflexao.likes ?? 0);
  const [likedBy, setLikedBy] = useState<string[]>(reflexao.likedBy ?? []);
  const [likePending, setLikePending] = useState(false);
  const [commentCount, setCommentCount] = useState<number>(reflexao.commentCount ?? 0);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const currentPath = typeof window !== "undefined"
    ? window.location.pathname + window.location.search
    : "/";

  const jaAmei = uid ? likedBy.includes(uid) : false;

  // ── useAudioSync ──────────────────────────────────────────────────────────
  const { handlePlayQueueItem } = useAudioSync(reflexao.id ?? "", fromParam);

  // ── TTS ──────────────────────────────────────────────────────────────────
  // error exposto para estado visual "Tentar novamente"
  const { resolveAudioUrl, isGenerating: ttsGenerating, error: ttsError } = useTTS();

  useEffect(() => {
    const currentUid = auth.currentUser?.uid;
    if (currentUid && reflexao.autorId && currentUid === reflexao.autorId) {
      setIsOwner(true);
    }
  }, [reflexao.autorId]);

  async function handleDeletar() {
    if (!reflexao.id) return;
    if (!confirm("Tem certeza que deseja apagar esta reflexão?")) return;
    setDeletando(true);
    try {
      await deleteDoc(doc(db, "posts", reflexao.id));
      router.push(`/perfil/${autorSlug}`);
    } catch (err) {
      console.error(err);
      setDeletando(false);
    }
  }

  async function handleLike() {
    if (likePending) return;
    if (!uid) {
      setShowLoginModal(true);
      return;
    }
    if (!reflexao.id) return;
    setLikePending(true);

    const novoJaAmei = !jaAmei;
    setLikedBy((prev) => novoJaAmei ? [...prev, uid] : prev.filter((id) => id !== uid));
    setLikes((prev) => prev + (novoJaAmei ? 1 : -1));

    try {
      await runTransaction(db, async (transaction) => {
        const ref = doc(db, "posts", reflexao.id!);
        const snap = await transaction.get(ref);
        if (!snap.exists()) return;
        const data = snap.data();
        const currentLikedBy: string[] = data.likedBy ?? [];
        const alreadyLiked = currentLikedBy.includes(uid);
        transaction.update(ref, {
          likes: increment(alreadyLiked ? -1 : 1),
          likedBy: alreadyLiked ? arrayRemove(uid) : arrayUnion(uid),
        });
      });
    } catch (err) {
      console.error(err);
      setLikedBy((prev) => novoJaAmei ? prev.filter((id) => id !== uid) : [...prev, uid]);
      setLikes((prev) => prev + (novoJaAmei ? -1 : 1));
    } finally {
      setLikePending(false);
    }
  }

  function handleScrollToComments() {
    if (!uid) {
      setShowLoginModal(true);
      return;
    }
    document.getElementById("reflexao-comments")?.scrollIntoView({ behavior: "smooth" });
  }

  const {
    playOrToggle,
    playQueue,
    queue,
    contextType,
    isCurrentlyPlaying,
    isCurrentPublication,
    isLoading: audioLoading,
    current,
  } = useAudioPlayer();

  const audioAtivo    = isCurrentPublication(reflexao.id ?? "");
  const audioTocando  = isCurrentlyPlaying(reflexao.id ?? "");
  const audioCarregando = audioAtivo && audioLoading;

  const ouvirBtnRef = useRef<HTMLSpanElement>(null);
  const [ouvirFlutuante, setOuvirFlutuante] = useState(false);
  const [buildingQueue, setBuildingQueue] = useState(false);

  useEffect(() => {
    const el = ouvirBtnRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setOuvirFlutuante(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const ouvirOcupado = ttsGenerating || buildingQueue || audioCarregando;

  // ── Quatro estados visuais do botão Ouvir ────────────────────────────────
  // idle → "Ouvir"
  // gerando → "Gerando áudio…" (ttsGenerating)
  // carregando → "Carregando…" (buildingQueue | audioCarregando)
  // tocando → "Pausar" (audioTocando)
  // erro → "Tentar novamente" (ttsError && !ttsGenerating)
  const ouvirLabel =
    ttsGenerating   ? "Gerando áudio…"   :
    buildingQueue   ? "Carregando…"      :
    audioCarregando ? "Carregando…"      :
    ttsError        ? "Tentar novamente" :
    audioTocando    ? "Pausar"           :
    audioAtivo      ? "Continuar"        :
    "Ouvir";

  // Cores do botão: vermelho em erro, verde quando ativo, padrão caso contrário
  const ouvirBtnBorderColor = ttsError
    ? "var(--red-dim, #fecaca)"
    : audioAtivo
    ? "var(--emerald-dim)"
    : "var(--border-light)";

  const ouvirBtnBg = ttsError
    ? "var(--red-dim, #fef2f2)"
    : audioAtivo
    ? "var(--emerald-dim)"
    : "transparent";

  const ouvirBtnColor = ttsError
    ? "var(--red, #ef4444)"
    : audioAtivo
    ? "var(--emerald)"
    : "var(--text-3)";

  async function handleOuvir(e: React.MouseEvent) {
    e.stopPropagation();
    if (!auth.currentUser) {
      setShowLoginModal(true);
      return;
    }
    if (!reflexao.id) return;

    // Se já há fila ativa com esta reflexão, apenas toggle
    if (queue.length > 0 && queue.some((p) => p.id === reflexao.id)) {
      playOrToggle(pubDestaReflexao());
      return;
    }

    setBuildingQueue(true);
    try {
      // Resolve audioUrl via TTS se necessário
      const audioUrl = await resolveAudioUrl({
        postId: reflexao.id,
        tipo: "reflexao",
        titulo: reflexao.titulo,
        audioUrlExistente: reflexao.audioUrl && reflexao.audioStatus === "ready"
          ? reflexao.audioUrl
          : undefined,
      });

      const pub = pubDestaReflexao(audioUrl);

      // Monta fila de todas as reflexões do mesmo autor
      const snap = await getDocs(
        query(
          collection(db, "posts"),
          where("autorId", "==", reflexao.autorId),
          where("tipo", "==", "reflexao"),
          orderBy("criadoEm", "desc")
        )
      );

      const novaFila: AudioPublication[] = snap.docs.map((d) => ({
        id: d.id,
        tipo: "reflexao" as const,
        titulo: d.data().titulo || "Sem título",
        autorNome: d.data().autorNome || reflexao.autorNome,
        autorFoto: null,
        slug: d.data().slug ?? d.id,
        autorSlug: d.data().autorSlug ?? autorSlug,
        audioUrl: (d.data().audioUrl as string) || FALLBACK_AUDIO,
      }));

      if (novaFila.length > 0) {
        playQueue(pub, novaFila, "perfil");
      } else {
        playQueue(pub, [pub], "perfil");
      }
    } catch (err) {
      console.error("Erro ao montar fila de reflexões:", err);
      // ttsError já foi setado pelo hook — o botão mostrará "Tentar novamente"
    }
    setBuildingQueue(false);
  }

  function pubDestaReflexao(audioUrl?: string): AudioPublication {
    return {
      id: reflexao.id ?? "",
      tipo: "reflexao",
      titulo: reflexao.titulo,
      autorNome: reflexao.autorNome,
      autorFoto: null,
      slug: reflexao.slug,
      autorSlug: autorSlug,
      audioUrl: audioUrl ?? reflexao.audioUrl ?? FALLBACK_AUDIO,
    };
  }

  const paragrafos = reflexao.conteudo
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const origemHref =
    reflexao.publicacaoOrigemTipo === "artigo"
      ? `/posts/estudos/${reflexao.publicacaoOrigemSlug}`
      : `/posts/sermoes/${reflexao.publicacaoOrigemSlug}`;

  const origemLabel =
    reflexao.publicacaoOrigemTipo === "artigo"
      ? "→ Ler o estudo completo"
      : "→ Ler o sermão completo";

  const temAtribuicao =
    reflexao.imagemFotografoNome &&
    reflexao.imagemFotografoUrl &&
    reflexao.imagemUnsplashUrl;

  return (
    <div style={{
      maxWidth: 680,
      margin: "0 auto",
      padding: "2rem 1.25rem 4rem",
      display: "flex",
      flexDirection: "column",
      gap: "2rem",
    }}>
      {/* Modal de login global */}
      {showLoginModal && (
        <BannerLogin
          modal
          onClose={() => setShowLoginModal(false)}
          redirectTo={currentPath}
        />
      )}

      {/* ── Barra de ações do autor ── */}
      {isOwner && (
        <div style={{
          display: "flex", gap: "0.625rem", padding: "0.875rem 1.125rem",
          background: "var(--bg-elevated)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)", alignItems: "center",
        }}>
          <span style={{ fontSize: "0.78rem", color: "var(--text-3)", fontWeight: 600, flex: 1 }}>
            Você é o autor desta reflexão
          </span>
          <button
            onClick={() => router.push(`/editar-reflexao/${reflexao.id}`)}
            className="post-btn-edit"
            style={{ fontSize: "0.78rem", padding: "6px 14px" }}
          >
            ✏ Editar
          </button>
          <button
            onClick={handleDeletar}
            disabled={deletando}
            className="post-btn-delete"
            style={{ fontSize: "0.78rem", padding: "6px 14px", opacity: deletando ? 0.6 : 1 }}
          >
            {deletando ? "Apagando..." : "🗑 Apagar"}
          </button>
        </div>
      )}

      {/* ── Imagem de capa ── */}
      {reflexao.imagemCapa && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <div style={{
            width: "100%", borderRadius: "var(--radius-xl)", overflow: "hidden",
            aspectRatio: "1200/630", background: "var(--bg-elevated)",
          }}>
            <img
              src={reflexao.imagemCapa}
              alt={reflexao.titulo}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </div>
          {temAtribuicao && (
            <p style={{ fontSize: "0.7rem", color: "var(--text-3)", margin: 0, textAlign: "right" }}>
              Foto por{" "}
              <a href={reflexao.imagemFotografoUrl} target="_blank" rel="noopener noreferrer"
                style={{ color: "var(--text-3)", textDecoration: "underline" }}>
                {reflexao.imagemFotografoNome}
              </a>
              {" "}no{" "}
              <a href={reflexao.imagemUnsplashUrl} target="_blank" rel="noopener noreferrer"
                style={{ color: "var(--text-3)", textDecoration: "underline" }}>
                Unsplash
              </a>
            </p>
          )}
        </div>
      )}

      {/* ── Cabeçalho ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <span style={{
          alignSelf: "flex-start", fontSize: "0.65rem", fontWeight: 700,
          letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--emerald)",
          background: "var(--emerald-dim)", padding: "3px 10px", borderRadius: "var(--radius-full)",
        }}>
          Reflexão
        </span>
        <h1 style={{
          fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 800, color: "var(--text-1)",
          lineHeight: 1.2, margin: 0,
        }}>
          {reflexao.titulo}
        </h1>
        <p style={{ fontSize: "0.85rem", color: "var(--text-3)", margin: 0 }}>
          Por{" "}
          <Link href={`/perfil/${autorSlug}`} style={{ color: "var(--emerald)", textDecoration: "none" }}>
            {reflexao.autorNome}
          </Link>
        </p>
      </div>

      {/* ── Frase instigadora ── */}
      <blockquote style={{
        margin: 0, padding: "1.25rem 1.5rem",
        borderLeft: "3px solid var(--emerald)",
        background: "var(--bg-elevated)",
        borderRadius: "0 var(--radius-md) var(--radius-md) 0",
      }}>
        <p style={{
          fontSize: "1.05rem", fontStyle: "italic", color: "var(--text-1)",
          lineHeight: 1.6, margin: 0, fontWeight: 500,
        }}>
          {reflexao.fraseInstigadora}
        </p>
      </blockquote>

      {/* ── Conteúdo ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {paragrafos.map((p, i) => (
          <p key={i} style={{ fontSize: "1rem", color: "var(--text-2)", lineHeight: 1.75, margin: 0 }}>
            {p}
          </p>
        ))}
      </div>

      {/* ── Pergunta reflexiva ── */}
      <div style={{
        padding: "1.5rem", borderRadius: "var(--radius-lg)",
        background: "var(--bg-elevated)", border: "1px solid var(--border-light)",
        display: "flex", flexDirection: "column", gap: "0.625rem",
      }}>
        <span style={{
          fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em",
          textTransform: "uppercase", color: "var(--text-3)",
        }}>
          Para refletir
        </span>
        <p style={{ fontSize: "1rem", color: "var(--text-1)", fontWeight: 600, lineHeight: 1.5, margin: 0 }}>
          {reflexao.perguntaReflexiva}
        </p>
      </div>

      {/* ── Amei + Comentar + Ouvir ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: "0.5rem",
        padding: "0.875rem 1.125rem", borderRadius: "var(--radius-lg)",
        background: "var(--bg-elevated)", border: "1px solid var(--border-light)",
        flexWrap: "wrap",
      }}>
        <button
          onClick={handleLike}
          disabled={likePending}
          aria-label={jaAmei ? "Remover curtida" : "Curtir reflexão"}
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.4rem",
            padding: "6px 14px", borderRadius: "var(--radius-full)", border: "1px solid",
            borderColor: jaAmei ? "var(--emerald-dim)" : "var(--border-light)",
            background: jaAmei ? "var(--emerald-dim)" : "transparent",
            color: jaAmei ? "var(--emerald)" : "var(--text-3)",
            fontSize: "0.82rem", fontWeight: 600,
            cursor: likePending ? "default" : "pointer",
            opacity: likePending ? 0.7 : 1,
            transition: "all 0.2s cubic-bezier(0.4,0,0.2,1)", fontFamily: "inherit",
          }}
        >
          <IconHeart size={15} filled={jaAmei} />
          <span>Amei</span>
          {likes > 0 && (
            <span style={{ fontSize: "0.75rem", color: jaAmei ? "var(--emerald)" : "var(--text-3)" }}>
              {likes}
            </span>
          )}
        </button>

        <button
          onClick={handleScrollToComments}
          aria-label="Ir para comentários"
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.4rem",
            padding: "6px 14px", borderRadius: "var(--radius-full)",
            border: "1px solid var(--border-light)", background: "transparent",
            color: "var(--text-3)", fontSize: "0.82rem", fontWeight: 600,
            cursor: "pointer", transition: "all 0.2s cubic-bezier(0.4,0,0.2,1)",
            fontFamily: "inherit",
          }}
        >
          <IconComment size={15} />
          <span>Comentar</span>
          {commentCount > 0 && (
            <span style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>{commentCount}</span>
          )}
        </button>

        {/* ── Botão Ouvir inline ── */}
        <button
          onClick={handleOuvir}
          disabled={ouvirOcupado}
          aria-label={
            ttsError     ? "Tentar novamente"    :
            audioTocando ? "Pausar áudio"        :
            "Ouvir reflexão"
          }
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.4rem",
            padding: "6px 14px", borderRadius: "var(--radius-full)",
            border: `1px solid ${ouvirBtnBorderColor}`,
            background: ouvirBtnBg,
            color: ouvirBtnColor,
            fontSize: "0.82rem", fontWeight: 600,
            cursor: ouvirOcupado ? "default" : "pointer",
            opacity: ouvirOcupado ? 0.7 : 1,
            transition: "all 0.2s cubic-bezier(0.4,0,0.2,1)",
            fontFamily: "inherit",
          }}
        >
          {ttsGenerating ? (
            /* spinner de geração */
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          ) : ttsError ? (
            /* ícone de aviso para "Tentar novamente" */
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          ) : audioTocando ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v14l11-7-11-7z" /></svg>
          )}
          <span>{ouvirLabel}</span>
          {audioTocando && (
            <span style={{ fontSize: "0.68rem", fontStyle: "italic", opacity: 0.8 }}>
              · tocando
            </span>
          )}
        </button>
      </div>

      {/* Âncora invisível para o IntersectionObserver */}
      <span ref={ouvirBtnRef} style={{ display: "none" }} aria-hidden="true" />

      {/* Botão flutuante */}
      {ouvirFlutuante && !current && (
        <button
          onClick={handleOuvir}
          disabled={ouvirOcupado}
          aria-label={
            ttsError     ? "Tentar novamente"    :
            audioTocando ? "Pausar áudio"        :
            "Ouvir reflexão"
          }
          style={{
            position: "fixed",
            top: "calc(var(--header-h) + 12px)",
            right: "16px",
            zIndex: 800,
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 16px",
            borderRadius: "var(--radius-full)",
            border: `1px solid ${ouvirBtnBorderColor}`,
            background: ttsError
              ? "var(--red-dim, #fef2f2)"
              : audioTocando
              ? "var(--emerald)"
              : "var(--bg-card)",
            color: ttsError
              ? "var(--red, #ef4444)"
              : audioTocando
              ? "#fff"
              : "var(--emerald)",
            fontSize: "0.8rem",
            fontWeight: 700,
            cursor: ouvirOcupado ? "default" : "pointer",
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            backdropFilter: "blur(8px)",
            transition: "all 0.2s ease",
            fontFamily: "inherit",
            opacity: ouvirOcupado ? 0.7 : 1,
          }}
        >
          {ttsGenerating ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          ) : buildingQueue || audioCarregando ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          ) : ttsError ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          ) : audioTocando ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v14l11-7-11-7z"/></svg>
          )}
          <span>{ouvirLabel}</span>
        </button>
      )}

      {/* ── Compartilhar no WhatsApp ── */}
      <div style={{
        display: "flex", flexDirection: "column", gap: "0.75rem", padding: "1.5rem",
        borderRadius: "var(--radius-lg)", background: "var(--bg-card)", border: "1px solid var(--border)",
      }}>
        <p style={{
          fontSize: "0.82rem", color: "var(--text-3)", margin: 0,
          fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em",
        }}>
          Compartilhe com seu grupo
        </p>
        <p style={{ fontSize: "0.85rem", color: "var(--text-2)", margin: 0, lineHeight: 1.5 }}>
          Ao enviar o link no WhatsApp, a imagem desta reflexão e a frase
          aparecem automaticamente — sem precisar copiar nada.
        </p>
        <CompartilharWhatsapp
          fraseInstigadora={reflexao.fraseInstigadora}
          conteudo={reflexao.conteudo}
          slug={reflexao.slug}
          autorSlug={autorSlug}
        />
      </div>

      <div style={{ height: "1px", background: "var(--border)" }} />

      {/* ── Link para a publicação original ── */}
      {reflexao.publicacaoOrigemSlug && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <p style={{ fontSize: "0.8rem", color: "var(--text-3)", margin: 0 }}>
            Esta reflexão foi extraída de:
          </p>
          <Link
            href={origemHref}
            style={{
              display: "inline-flex", alignItems: "center", gap: "0.5rem",
              fontSize: "0.875rem", fontWeight: 600, color: "var(--emerald)",
              textDecoration: "none", padding: "10px 16px",
              background: "var(--bg-elevated)", border: "1px solid var(--border-light)",
              borderRadius: "var(--radius-md)", transition: "border-color 0.15s",
            }}
          >
            {origemLabel}
          </Link>
        </div>
      )}

      {/* ── Navegação ── */}
      {reflexao.id && reflexao.autorId && (
        <ReflexaoNavigation
          reflexaoId={reflexao.id}
          autorId={reflexao.autorId}
          autorSlugAtual={autorSlug}
          onPlayQueueItem={handlePlayQueueItem}
        />
      )}

      {/* ── Comentários ── */}
      {reflexao.id && (
        <div id="reflexao-comments">
          <CommentSection
            postId={reflexao.id}
            collectionRoot="posts"
            onCountChange={setCommentCount}
          />
        </div>
      )}
    </div>
  );
}