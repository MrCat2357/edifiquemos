"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { db, auth } from "@/lib/firebase";
import {
  doc, updateDoc, arrayUnion, arrayRemove,
  increment, getDoc, deleteDoc,
  collection, query, orderBy, getDocs, where,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { gerarPDF } from "@/lib/gerarPDF";
import LinksReferencia from "@/components/LinksReferencia";

/* ── helpers ─────────────────────────────────────────── */

export function formatData(data: any) {
  if (!data) return "";
  if (data?.toDate) return data.toDate().toLocaleDateString("pt-BR");
  if (typeof data === "string") return data;
  return new Date(data).toLocaleDateString("pt-BR");
}

export function getInitials(name: string) {
  if (!name) return "?";
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export function AuthorAvatar({
  src,
  name,
  size = 40,
}: {
  src?: string | null;
  name: string;
  size?: number;
}) {
  if (src)
    return (
      <img
        src={src}
        alt={name}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
        }}
      />
    );
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "linear-gradient(135deg, var(--emerald-dark), var(--emerald))",
        color: "#fff",
        fontSize: Math.round(size * 0.36) + "px",
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {getInitials(name)}
    </div>
  );
}

/* ── SVG Icons ───────────────────────────────────────── */

function IconDownload({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M8 2v7M8 9l-2.5-2.5M8 9l2.5-2.5"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconHeart({ size = 14, filled = false }: { size?: number; filled?: boolean }) {
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

function IconShare({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M11 1.5a2 2 0 1 1 .001 3.999A2 2 0 0 1 11 1.5ZM5 7a2 2 0 1 1 .001 3.999A2 2 0 0 1 5 7Zm6 3.5a2 2 0 1 1 .001 3.999A2 2 0 0 1 11 10.5Z"
        stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 8.5l-1.5-.9M7 7.5L5.5 8.4M7 8.5l4-2.5M7 7.5l4 2.5"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconEye({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M1.5 8C3 4.5 5.3 3 8 3s5 1.5 6.5 5C13 11.5 10.7 13 8 13S3 11.5 1.5 8Z"
        stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.3" />
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

/* ── Navegação entre posts ───────────────────────────── */

type PostNav = {
  id: string;
  titulo: string;
  slug?: string;
  tipo: string;
  autorId?: string;
  autorNome?: string;
};

type PostNavAutor = { nome: string; fotoUrl: string | null };

function PostNavigation({ postId, autorIdProp }: { postId: string; autorIdProp?: string }) {
  const router = useRouter();

  const [prev, setPrev] = useState<PostNav | null>(null);
  const [next, setNext] = useState<PostNav | null>(null);
  const [prevAutor, setPrevAutor] = useState<PostNavAutor | null>(null);
  const [nextAutor, setNextAutor] = useState<PostNavAutor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchNav() {
      try {
        const q = autorIdProp
          ? query(collection(db, "posts"), where("autorId", "==", autorIdProp), orderBy("data", "desc"))
          : query(collection(db, "posts"), orderBy("data", "desc"));

        const snap = await getDocs(q);
        const all: PostNav[] = snap.docs.map((d) => ({
          id: d.id,
          titulo: d.data().titulo || "Sem título",
          slug: d.data().slug,
          tipo: d.data().tipo,
          autorId: d.data().autorId,
          autorNome: d.data().autorNome,
        }));
        const idx = all.findIndex((p) => p.id === postId);
        if (idx === -1) { setLoading(false); return; }

        const p = idx + 1 < all.length ? all[idx + 1] : null;
        const n = idx - 1 >= 0 ? all[idx - 1] : null;
        setPrev(p);
        setNext(n);

        async function fetchAutorData(post: PostNav): Promise<PostNavAutor> {
          if (!post.autorId) return { nome: post.autorNome || "Autor", fotoUrl: null };
          try {
            const snap = await getDoc(doc(db, "users", post.autorId));
            if (snap.exists()) {
              const d = snap.data();
              const nome =
                d.titulo && d.nome
                  ? `${d.titulo.trim()} ${d.nome.trim()}`
                  : d.nome?.trim() || post.autorNome || "Autor";
              return { nome, fotoUrl: d.fotoUrl ?? null };
            }
          } catch {}
          return { nome: post.autorNome || "Autor", fotoUrl: null };
        }

        const [pa, na] = await Promise.all([
          p ? fetchAutorData(p) : Promise.resolve(null),
          n ? fetchAutorData(n) : Promise.resolve(null),
        ]);
        setPrevAutor(pa);
        setNextAutor(na);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    }
    fetchNav();
  }, [postId, autorIdProp]);

  function navUrl(p: PostNav) {
    return p.slug
      ? `/posts/${p.tipo === "sermao" ? "sermoes" : "artigos"}/${p.slug}`
      : `/posts/${p.id}`;
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
  };

  return (
    <nav
      className="post-nav"
      aria-label="Navegação entre publicações"
      style={{
        display: "grid",
        gridTemplateColumns: prev && next ? "1fr 1fr" : prev ? "1fr auto" : "auto 1fr",
        gap: "0.75rem",
        marginTop: "2rem",
      }}
    >
      {/* ← Anterior */}
      {prev ? (
        <button
          onClick={() => router.push(navUrl(prev))}
          className="post-nav-btn post-nav-btn--prev"
          aria-label={`Publicação anterior: ${prev.titulo}`}
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
            {prev.tipo === "sermao" ? "Sermão anterior" : "Artigo anterior"}
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
              <AuthorAvatar src={prevAutor.fotoUrl} name={prevAutor.nome} size={22} />
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

      {/* → Próximo */}
      {next ? (
        <button
          onClick={() => router.push(navUrl(next))}
          className="post-nav-btn post-nav-btn--next"
          aria-label={`Próxima publicação: ${next.titulo}`}
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
            {next.tipo === "sermao" ? "Próximo sermão" : "Próximo artigo"}
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
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
              <span style={{
                fontSize: "0.72rem", color: "var(--text-3)",
                fontStyle: "italic", overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {nextAutor.nome}
              </span>
              <AuthorAvatar src={nextAutor.fotoUrl} name={nextAutor.nome} size={22} />
            </div>
          )}
        </button>
      ) : (
        <span />
      )}
    </nav>
  );
}

/* ── Modal: quem curtiu ──────────────────────────────── */

function LikesModal({
  likedBy,
  onClose,
}: {
  likedBy: string[];
  onClose: () => void;
}) {
  const [pessoas, setPessoas] = useState<
    { uid: string; nome: string; foto: string | null }[]
  >([]);
  const [loadingModal, setLoadingModal] = useState(true);

  useEffect(() => {
    async function fetchPessoas() {
      const resultado: { uid: string; nome: string; foto: string | null }[] = [];
      await Promise.all(
        likedBy.slice(0, 50).map(async (uid) => {
          try {
            const snap = await getDoc(doc(db, "users", uid));
            if (snap.exists()) {
              const d = snap.data();
              resultado.push({
                uid,
                nome:
                  d.titulo && d.nome
                    ? `${d.titulo.trim()} ${d.nome.trim()}`
                    : d.nome?.trim() || "Usuário",
                foto: d.fotoUrl ?? null,
              });
            }
          } catch {}
        })
      );
      resultado.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      setPessoas(resultado);
      setLoadingModal(false);
    }
    fetchPessoas();
  }, [likedBy]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-card)", border: "1px solid var(--border-light)",
          borderRadius: "var(--radius-lg)", padding: "1.5rem",
          width: "100%", maxWidth: 360, maxHeight: "70vh",
          display: "flex", flexDirection: "column", gap: "1rem",
          boxShadow: "0 16px 60px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-1)", display: "flex", alignItems: "center", gap: "6px" }}>
            <IconHeart size={15} filled />
            Amaram este conteúdo
            {likedBy.length > 0 && (
              <span style={{ fontSize: "0.8rem", color: "var(--text-3)", fontWeight: 400 }}>
                ({likedBy.length}{likedBy.length > 50 ? ", mostrando 50" : ""})
              </span>
            )}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-3)", fontSize: "1.2rem", lineHeight: 1,
              padding: "2px 6px", borderRadius: "var(--radius-sm)",
            }}
          >
            ×
          </button>
        </div>
        <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {loadingModal ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
              <div className="spinner" />
            </div>
          ) : pessoas.length === 0 ? (
            <p style={{ color: "var(--text-3)", fontSize: "0.85rem", textAlign: "center", padding: "1.5rem 0" }}>
              Nenhum usuário encontrado.
            </p>
          ) : (
            pessoas.map((p) => (
              <div key={p.uid} style={{
                display: "flex", alignItems: "center", gap: "0.625rem",
                padding: "0.375rem 0.5rem", borderRadius: "var(--radius-sm)",
              }}>
                <AuthorAvatar src={p.foto} name={p.nome} size={32} />
                <span style={{ fontSize: "0.875rem", color: "var(--text-1)", fontWeight: 500 }}>
                  {p.nome}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ── ShareDropdown ───────────────────────────────────── */

function ShareDropdown({
  anchorRef,
  dropdownRef,
  urlAtual,
  textoCompartilhar,
  urlEncoded,
  conteudo,
  copiado,
  onCopiar,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLButtonElement>;
  dropdownRef: React.RefObject<HTMLDivElement>;
  urlAtual: string;
  textoCompartilhar: string;
  urlEncoded: string;
  conteudo: string;
  copiado: boolean;
  onCopiar: () => void;
  onClose: () => void;
}) {
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const dropdownH = 160;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < dropdownH + 12;
    setPos({
      top: openUp ? rect.top - dropdownH - 6 : rect.bottom + 6,
      left: Math.min(rect.left, window.innerWidth - 280),
    });
  }, []);

  const emailBody = encodeURIComponent(
    `${conteudo.slice(0, 300)}...\n\nLer completo: ${urlAtual}`
  );

  return (
    <div
      ref={dropdownRef}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed", top: pos.top, left: pos.left,
        background: "var(--bg-elevated)", border: "1px solid var(--border-light)",
        borderRadius: "var(--radius-lg)", padding: "0.625rem",
        display: "flex", flexWrap: "wrap", gap: "0.375rem",
        width: 268, zIndex: 9999, boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      }}
    >
      <a href={`https://wa.me/?text=${textoCompartilhar}%20${urlEncoded}`}
        target="_blank" rel="noopener noreferrer"
        className="share-btn share-whatsapp" onClick={onClose}>WhatsApp</a>
      <a href={`https://www.facebook.com/sharer/sharer.php?u=${urlEncoded}`}
        target="_blank" rel="noopener noreferrer"
        className="share-btn share-facebook" onClick={onClose}>Facebook</a>
      <a href={`https://www.threads.net/intent/post?text=${textoCompartilhar}%20${urlEncoded}`}
        target="_blank" rel="noopener noreferrer"
        className="share-btn share-threads" onClick={onClose}>Threads</a>
      <a href={`https://twitter.com/intent/tweet?text=${textoCompartilhar}&url=${urlEncoded}`}
        target="_blank" rel="noopener noreferrer"
        className="share-btn share-twitter" onClick={onClose}>X (Twitter)</a>
      <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${urlEncoded}`}
        target="_blank" rel="noopener noreferrer"
        className="share-btn share-linkedin" onClick={onClose}>LinkedIn</a>
      <a href={`https://mail.google.com/mail/?view=cm&su=${textoCompartilhar}&body=${emailBody}`}
        className="share-btn share-email" onClick={onClose}>Email</a>
      <button onClick={onCopiar} className="share-btn share-copy">
        {copiado ? "✓ Copiado!" : "Copiar link"}
      </button>
    </div>
  );
}

/* ── SelectionPopup ──────────────────────────────────── */

function SelectionPopup({
  trechoSelecionado,
  posicao,
  isMobile,
  nomeAutor,
  tituloPost,
  urlAtual,
  onFechar,
  onToast,
}: {
  trechoSelecionado: string;
  posicao: { x: number; top: number; bottom: number };
  isMobile: boolean;
  nomeAutor: string;
  tituloPost: string;
  urlAtual: string;
  onFechar: () => void;
  onToast: (msg: string) => void;
}) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [copiado, setCopiado] = useState(false);

  const mensagem =
    `Li essa passagem e me lembrei de você:\n\n` +
    `"${trechoSelecionado}"\n\n` +
    `— ${nomeAutor}, em "${tituloPost}"\n\n` +
    `Leia a versão completa:\n` +
    `${urlAtual}`;

  const mensagemEncoded = encodeURIComponent(mensagem);

  async function handleCopiar() {
    try {
      await navigator.clipboard.writeText(mensagem);
      setCopiado(true);
      onToast("Trecho copiado!");
      setTimeout(() => { setCopiado(false); onFechar(); }, 1800);
    } catch {
      onToast("Não foi possível copiar.");
    }
  }

  const POPUP_W = 260;
  const POPUP_H = 44;
  const MARGIN = 8;

  const left = Math.max(
    MARGIN,
    Math.min(posicao.x - POPUP_W / 2, window.innerWidth - POPUP_W - MARGIN)
  );
  const openBelow = isMobile;
  const top = openBelow
    ? Math.min(posicao.bottom + 10, window.innerHeight - POPUP_H - MARGIN)
    : Math.max(MARGIN, posicao.top - POPUP_H - 10);

  useEffect(() => {
    function handler(e: MouseEvent | TouchEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onFechar();
      }
    }
    const t = setTimeout(() => {
      document.addEventListener("mousedown", handler);
      document.addEventListener("touchstart", handler);
    }, 150);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [onFechar]);

  const arrowDown = !openBelow;

  return (
    <div
      ref={popupRef}
      style={{
        position: "fixed", top, left, zIndex: 9990,
        background: "var(--bg-elevated)", border: "1px solid var(--border-light)",
        borderRadius: "var(--radius-full)", padding: "6px 10px",
        display: "flex", alignItems: "center", gap: "6px",
        boxShadow: "0 6px 24px rgba(0,0,0,0.5)",
        animation: "fadeUp 0.15s ease both", whiteSpace: "nowrap",
      }}
    >
      {arrowDown ? (
        <>
          <div style={{
            position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)",
            width: 0, height: 0,
            borderLeft: "6px solid transparent", borderRight: "6px solid transparent",
            borderTop: "6px solid var(--border-light)",
          }} />
          <div style={{
            position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%)",
            width: 0, height: 0,
            borderLeft: "6px solid transparent", borderRight: "6px solid transparent",
            borderTop: "6px solid var(--bg-elevated)",
          }} />
        </>
      ) : (
        <>
          <div style={{
            position: "absolute", top: -6, left: "50%", transform: "translateX(-50%)",
            width: 0, height: 0,
            borderLeft: "6px solid transparent", borderRight: "6px solid transparent",
            borderBottom: "6px solid var(--border-light)",
          }} />
          <div style={{
            position: "absolute", top: -5, left: "50%", transform: "translateX(-50%)",
            width: 0, height: 0,
            borderLeft: "6px solid transparent", borderRight: "6px solid transparent",
            borderBottom: "6px solid var(--bg-elevated)",
          }} />
        </>
      )}

      <span style={{ fontSize: "0.72rem", color: "var(--text-3)", fontWeight: 500 }}>
        Compartilhar trecho:
      </span>

      <a
        href={`https://wa.me/?text=${mensagemEncoded}`}
        target="_blank" rel="noopener noreferrer" onClick={onFechar}
        style={{
          display: "inline-flex", alignItems: "center",
          background: "#16a34a", color: "#fff",
          fontSize: "0.72rem", fontWeight: 600,
          padding: "4px 10px", borderRadius: "var(--radius-full)",
          textDecoration: "none", transition: "background 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#15803d")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "#16a34a")}
      >
        WhatsApp
      </a>

      <button
        onClick={handleCopiar}
        style={{
          display: "inline-flex", alignItems: "center",
          background: copiado ? "var(--emerald-dim)" : "var(--bg-card)",
          color: copiado ? "var(--emerald)" : "var(--text-2)",
          border: "1px solid var(--border-light)",
          fontSize: "0.72rem", fontWeight: 600,
          padding: "4px 10px", borderRadius: "var(--radius-full)",
          cursor: "pointer", transition: "all 0.15s",
        }}
      >
        {copiado ? "✓ Copiado!" : "Copiar"}
      </button>
    </div>
  );
}

/* ── Componente principal ────────────────────────────── */

export type PostDetailProps = {
  post: any;
  postId: string;
  autor: { nome?: string; titulo?: string; fotoUrl?: string | null } | null;
};

export default function PostDetailContent({ post, postId, autor }: PostDetailProps) {
  const router = useRouter();
  const { user } = useAuth();
  const conteudoRef = useRef<HTMLDivElement>(null);

  const [liked, setLiked] = useState<boolean>(() => {
    const uid = auth.currentUser?.uid;
    return uid ? (post.likedBy ?? []).includes(uid) : false;
  });
  const [likeCount, setLikeCount] = useState<number>(post.likes ?? 0);
  const [likedBy, setLikedBy] = useState<string[]>(post.likedBy ?? []);
  const [loadingLike, setLoadingLike] = useState(false);
  const [likesModalAberto, setLikesModalAberto] = useState(false);

  const [compartilharAberto, setCompartilharAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [downloadCount, setDownloadCount] = useState<number>(post.downloads ?? 0);

  const [viewCount, setViewCount] = useState<number>(post.visualizacoes ?? 0);

  useEffect(() => {
    async function registrarVisualizacao() {
      const uid = auth.currentUser?.uid;
      if (!uid) return;

      const sessionKey = `viewed_${postId}`;
      if (sessionStorage.getItem(sessionKey)) return;

      try {
        const ref = doc(db, "posts", postId);
        await updateDoc(ref, { visualizacoes: increment(1) });
        sessionStorage.setItem(sessionKey, "1");
        setViewCount((n) => n + 1);
      } catch (err) {
        console.error("Erro ao registrar visualização:", err);
      }
    }
    if (postId) registrarVisualizacao();
  }, [postId]);

  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shareButtonRef = useRef<HTMLButtonElement>(null!);
  const shareDropdownRef = useRef<HTMLDivElement>(null!);

  const [selecao, setSelecao] = useState<{
    trecho: string;
    posicao: { x: number; top: number; bottom: number };
    isMobile: boolean;
  } | null>(null);

  const detectarSelecao = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) { setSelecao(null); return; }
    const trecho = selection.toString().trim();
    if (trecho.length < 10) { setSelecao(null); return; }
    const range = selection.getRangeAt(0);
    if (!conteudoRef.current?.contains(range.commonAncestorContainer)) {
      setSelecao(null); return;
    }
    const rect = range.getBoundingClientRect();
    const mobile = window.matchMedia("(pointer: coarse)").matches;
    setSelecao({
      trecho: trecho.slice(0, 500),
      posicao: { x: rect.left + rect.width / 2, top: rect.top, bottom: rect.bottom },
      isMobile: mobile,
    });
  }, []);

  const handleMouseUp = useCallback(() => { detectarSelecao(); }, [detectarSelecao]);
  const handleTouchEnd = useCallback(() => { detectarSelecao(); }, [detectarSelecao]);

  useEffect(() => {
    const isMobile = window.matchMedia("(pointer: coarse)").matches;
    if (!isMobile) return;
    let timer: ReturnType<typeof setTimeout>;
    function onSelectionChange() {
      clearTimeout(timer);
      timer = setTimeout(detectarSelecao, 400);
    }
    document.addEventListener("selectionchange", onSelectionChange);
    return () => { clearTimeout(timer); document.removeEventListener("selectionchange", onSelectionChange); };
  }, [detectarSelecao]);

  useEffect(() => {
    if (!compartilharAberto) return;
    function handler(e: MouseEvent) {
      const target = e.target as Node;
      if (
        shareButtonRef.current && !shareButtonRef.current.contains(target) &&
        shareDropdownRef.current && !shareDropdownRef.current.contains(target)
      ) {
        setCompartilharAberto(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [compartilharAberto]);

  const nomeExibicao =
    autor?.titulo && autor?.nome
      ? `${autor.titulo} ${autor.nome}`
      : autor?.nome || post.autorNome || "Autor";
  const fotoAutor = autor?.fotoUrl ?? post.autorFoto ?? null;
  const isAutor = user?.uid === post.autorId;
  const urlAtual = typeof window !== "undefined" ? window.location.href : "";
  const textoCompartilhar = encodeURIComponent(`${post.titulo} - ${nomeExibicao}`);
  const urlEncoded = encodeURIComponent(urlAtual);

  function showToast(msg: string) {
    setToastMsg(msg);
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2200);
  }

  async function handleLike() {
    const uid = auth.currentUser?.uid;
    if (!uid) { showToast("Faça login para curtir"); return; }
    if (loadingLike) return;
    setLoadingLike(true);
    try {
      const ref = doc(db, "posts", postId);
      if (liked) {
        await updateDoc(ref, { likes: increment(-1), likedBy: arrayRemove(uid) });
        setLiked(false);
        setLikeCount((n) => Math.max(0, n - 1));
        setLikedBy((arr) => arr.filter((id) => id !== uid));
      } else {
        await updateDoc(ref, { likes: increment(1), likedBy: arrayUnion(uid) });
        setLiked(true);
        setLikeCount((n) => n + 1);
        setLikedBy((arr) => [...arr, uid]);
      }
    } catch (err) { console.error(err); }
    setLoadingLike(false);
  }

  async function copiarLink() {
    await navigator.clipboard.writeText(urlAtual);
    setCopiado(true);
    showToast("Link copiado!");
    setTimeout(() => setCopiado(false), 2000);
  }

  async function handleDownloadPdf() {
    if (gerandoPdf) return;
    setGerandoPdf(true);
    showToast("Gerando PDF...");
    try {
      await gerarPDF({
        titulo: post.titulo,
        nomeAutor: nomeExibicao,
        fotoAutor,
        dataPost: formatData(post.data),
        igreja: post.igreja || "",
        conteudo: post.conteudo,
        tipo: post.tipo,
        links: post.links ?? [],
        onDownload: async () => {
          try {
            await updateDoc(doc(db, "posts", postId), { downloads: increment(1) });
            setDownloadCount((n) => n + 1);
          } catch {}
        },
      });
    } catch (err) {
      console.error(err);
      showToast("Erro ao gerar PDF.");
    }
    setGerandoPdf(false);
  }

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

  const actionBtnStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
  };

  return (
    <>
      {/* Toast */}
      <div
        style={{
          position: "fixed", bottom: "1.5rem", left: "50%",
          transform: `translateX(-50%) translateY(${toastVisible ? 0 : "12px"})`,
          background: "var(--bg-elevated)", border: "1px solid var(--emerald-dim)",
          color: "var(--emerald)", fontSize: "0.82rem", fontWeight: 600,
          padding: "8px 20px", borderRadius: "var(--radius-full)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          opacity: toastVisible ? 1 : 0, transition: "all 0.25s ease",
          pointerEvents: "none", zIndex: 998,
        }}
      >
        {toastMsg}
      </div>

      {likesModalAberto && (
        <LikesModal likedBy={likedBy} onClose={() => setLikesModalAberto(false)} />
      )}

      {compartilharAberto && (
        <ShareDropdown
          anchorRef={shareButtonRef}
          dropdownRef={shareDropdownRef}
          urlAtual={urlAtual}
          textoCompartilhar={textoCompartilhar}
          urlEncoded={urlEncoded}
          conteudo={post.conteudo}
          copiado={copiado}
          onCopiar={copiarLink}
          onClose={() => setCompartilharAberto(false)}
        />
      )}

      {selecao && (
        <SelectionPopup
          trechoSelecionado={selecao.trecho}
          posicao={selecao.posicao}
          isMobile={selecao.isMobile}
          nomeAutor={nomeExibicao}
          tituloPost={post.titulo}
          urlAtual={urlAtual}
          onFechar={() => setSelecao(null)}
          onToast={showToast}
        />
      )}

      <article className="post-detail-card">
        {/* Topo: badge + botões de autor */}
        <div className="post-detail-top">
          <span className={`cat-badge ${post.tipo === "sermao" ? "cat-sermao" : "cat-artigo"}`}>
            {post.tipo === "sermao" ? "Sermão" : "Artigo"}
          </span>
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

        {/* Título */}
        <h1 className="post-detail-title">{post.titulo}</h1>

        {/* Meta */}
        <div className="post-detail-meta">
          <AuthorAvatar src={fotoAutor} name={nomeExibicao} size={32} />
          <span
            className="post-detail-autor"
            onClick={() => { if (post.autorId) router.push(`/perfil/${post.autorId}`); }}
          >
            {nomeExibicao}
          </span>
          {formatData(post.data) && (
            <>
              <span className="post-detail-sep">·</span>
              <span>{formatData(post.data)}</span>
            </>
          )}
          {post.igreja && (
            <>
              <span className="post-detail-sep">·</span>
              <span>{post.igreja}</span>
            </>
          )}
        </div>

        <hr className="post-detail-divider" />

        {/* ── IMAGEM DE CAPA — CORRIGIDA ── */}
        {post.imagemUrl && (
          <div
            className="post-detail-cover-wrapper"
            style={{
              width: "100%",
              borderRadius: "var(--radius-lg)",
              overflow: "hidden",
              border: "1px solid var(--border)",
              marginBottom: "1.5rem",
              /*
               * CORREÇÃO: fundo neutro escuro para preencher o espaço vazio
               * quando a imagem não é horizontal (ex: foto de livro vertical).
               * O flex centraliza a imagem dentro do container.
               */
              background: "#0d1310",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src={post.imagemUrl}
              alt={`Imagem de capa: ${post.titulo}`}
              style={{
                width: "100%",
                /*
                 * CORREÇÃO PRINCIPAL:
                 * - object-fit: contain → exibe a imagem inteira sem cortar nada
                 * - max-height: 520px  → limita para não ficar gigante no desktop
                 * - No mobile, o CSS abaixo reduz para 360px
                 */
                maxHeight: "520px",
                objectFit: "contain",
                display: "block",
              }}
            />
          </div>
        )}

        {/* Conteúdo */}
        <div
          ref={conteudoRef}
          className="post-detail-content"
          onMouseUp={handleMouseUp}
          onTouchEnd={handleTouchEnd}
        >
          {post.conteudo}
        </div>

        {/* Rodapé do conteúdo */}
        {post.tipo === "sermao" ? (
          <p className="post-detail-footer-text">
            {post.igreja
              ? `Sermão pregado na ${post.igreja}${formatData(post.data) ? ` em ${formatData(post.data)}` : ""}`
              : formatData(post.data)
              ? `Sermão pregado em ${formatData(post.data)}`
              : ""}
          </p>
        ) : (
          <p className="post-detail-footer-text">
            Artigo publicado por {nomeExibicao}
            {formatData(post.data) ? ` em ${formatData(post.data)}` : ""}
          </p>
        )}

        {/* ── Links de Referência ── */}
        {post.links && post.links.length > 0 && (
          <LinksReferencia links={post.links} />
        )}

        <hr className="post-detail-divider" />

        {/* ── Barra de ações ── */}
        <div className="post-detail-actions">

          {/* Amei */}
          <button
            onClick={handleLike}
            disabled={loadingLike}
            className={`post-btn-share ${liked ? "liked" : ""}`}
            style={{ opacity: loadingLike ? 0.6 : 1, ...actionBtnStyle }}
            title={user ? (liked ? "Remover curtida" : "Curtir") : "Faça login para curtir"}
          >
            <IconHeart size={14} filled={liked} />
            Amei
            {likeCount > 0 && (
              <span
                onClick={(e) => { e.stopPropagation(); setLikesModalAberto(true); }}
                title="Ver quem curtiu"
                style={{
                  marginLeft: "2px",
                  fontSize: "0.78rem", fontWeight: 700,
                  color: liked ? "inherit" : "var(--emerald)",
                  cursor: "pointer",
                }}
              >
                {likeCount}
              </span>
            )}
          </button>

          {/* Compartilhar */}
          <button
            ref={shareButtonRef}
            onClick={() => setCompartilharAberto((v) => !v)}
            className="post-btn-share"
            style={actionBtnStyle}
          >
            <IconShare size={14} />
            Compartilhar
          </button>

          {/* Salvar PDF */}
          <button
            onClick={handleDownloadPdf}
            disabled={gerandoPdf}
            className="post-btn-share"
            style={{ opacity: gerandoPdf ? 0.6 : 1, ...actionBtnStyle }}
            title="Baixar como PDF"
          >
            {gerandoPdf ? (
              <><span className="btn-spinner" />Gerando…</>
            ) : (
              <><IconDownload size={14} />Salvar PDF</>
            )}
            {downloadCount > 0 && (
              <span style={{ marginLeft: "2px", fontSize: "0.78rem", fontWeight: 700, color: "var(--text-3)" }}
                title={`${downloadCount} download${downloadCount !== 1 ? "s" : ""}`}>
                {downloadCount}
              </span>
            )}
          </button>

          {/* Visualizações — chip passivo */}
          <div
            style={{
              display: "inline-flex", alignItems: "center", gap: "5px",
              fontSize: "0.85rem", fontWeight: 500, color: "var(--text-3)",
              padding: "7px 12px",
              border: "1px solid transparent",
              borderRadius: "var(--radius-full)",
              userSelect: "none",
              pointerEvents: "none",
            }}
            title={`${viewCount} visualização${viewCount !== 1 ? "ões" : ""}`}
          >
            <IconEye size={14} />
            <span>{viewCount}</span>
          </div>

        </div>

        {/* ── Navegação entre posts ── */}
        <PostNavigation postId={postId} autorIdProp={post.autorId} />
      </article>

      <style>{`
        /* CORREÇÃO MOBILE: altura máxima menor para imagens de capa */
        @media (max-width: 640px) {
          .post-detail-cover-wrapper img {
            max-height: 360px !important;
          }
        }
      `}</style>
    </>
  );
}