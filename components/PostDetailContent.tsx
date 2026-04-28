"use client";

import { useState, useRef, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import {
  doc, updateDoc, arrayUnion, arrayRemove,
  increment, getDoc, deleteDoc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { gerarPDF } from "@/lib/gerarPDF";

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

export function AuthorAvatar({ src, name, size = 40 }: { src?: string | null; name: string; size?: number }) {
  if (src)
    return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "linear-gradient(135deg, var(--emerald-dark), var(--emerald))",
      color: "#fff", fontSize: Math.round(size * 0.36) + "px",
      fontWeight: 700, display: "flex", alignItems: "center",
      justifyContent: "center", flexShrink: 0, userSelect: "none",
    }}>
      {getInitials(name)}
    </div>
  );
}

/* ── Modal: quem curtiu ──────────────────────────────── */

function LikesModal({ likedBy, onClose }: { likedBy: string[]; onClose: () => void }) {
  const [pessoas, setPessoas] = useState<{ uid: string; nome: string; foto: string | null }[]>([]);
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
                nome: d.titulo && d.nome ? `${d.titulo.trim()} ${d.nome.trim()}` : d.nome?.trim() || "Usuário",
                foto: d.fotoUrl ?? null,
              });
            }
          } catch { }
        })
      );
      resultado.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      setPessoas(resultado);
      setLoadingModal(false);
    }
    fetchPessoas();
  }, [likedBy]);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "var(--bg-card)", border: "1px solid var(--border-light)",
        borderRadius: "var(--radius-lg)", padding: "1.5rem",
        width: "100%", maxWidth: 360, maxHeight: "70vh",
        display: "flex", flexDirection: "column", gap: "1rem",
        boxShadow: "0 16px 60px rgba(0,0,0,0.5)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-1)" }}>
            ❤️ Amaram este conteúdo
            {likedBy.length > 0 && (
              <span style={{ marginLeft: 6, fontSize: "0.8rem", color: "var(--text-3)", fontWeight: 400 }}>
                ({likedBy.length}{likedBy.length > 50 ? ", mostrando 50" : ""})
              </span>
            )}
          </h3>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-3)", fontSize: "1.2rem", lineHeight: 1,
            padding: "2px 6px", borderRadius: "var(--radius-sm)",
          }}>×</button>
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
          ) : pessoas.map((p) => (
            <div key={p.uid} style={{ display: "flex", alignItems: "center", gap: "0.625rem", padding: "0.375rem 0.5rem", borderRadius: "var(--radius-sm)" }}>
              <AuthorAvatar src={p.foto} name={p.nome} size={32} />
              <span style={{ fontSize: "0.875rem", color: "var(--text-1)", fontWeight: 500 }}>{p.nome}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── ShareDropdown ── */

function ShareDropdown({
  anchorRef, dropdownRef, urlAtual, textoCompartilhar, urlEncoded,
  conteudo, copiado, onCopiar, onClose,
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

  const emailBody = encodeURIComponent(`${conteudo.slice(0, 300)}...\n\nLer completo: ${urlAtual}`);

  return (
    <div
      ref={dropdownRef}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-light)",
        borderRadius: "var(--radius-lg)",
        padding: "0.625rem",
        display: "flex", flexWrap: "wrap", gap: "0.375rem",
        width: 268, zIndex: 9999,
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      }}
    >
      <a href={`https://wa.me/?text=${textoCompartilhar}%20${urlEncoded}`} target="_blank" rel="noopener noreferrer" className="share-btn share-whatsapp" onClick={onClose}>WhatsApp</a>
      <a href={`https://www.facebook.com/sharer/sharer.php?u=${urlEncoded}`} target="_blank" rel="noopener noreferrer" className="share-btn share-facebook" onClick={onClose}>Facebook</a>
      <a href={`https://www.threads.net/intent/post?text=${textoCompartilhar}%20${urlEncoded}`} target="_blank" rel="noopener noreferrer" className="share-btn share-threads" onClick={onClose}>Threads</a>
      <a href={`https://twitter.com/intent/tweet?text=${textoCompartilhar}&url=${urlEncoded}`} target="_blank" rel="noopener noreferrer" className="share-btn share-twitter" onClick={onClose}>X (Twitter)</a>
      <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${urlEncoded}`} target="_blank" rel="noopener noreferrer" className="share-btn share-linkedin" onClick={onClose}>LinkedIn</a>
      <a
        href={`https://mail.google.com/mail/?view=cm&su=${textoCompartilhar}&body=${emailBody}`}
        className="share-btn share-email"
        onClick={onClose}
      >
        Email
      </a>
      <button onClick={onCopiar} className="share-btn share-copy">
        {copiado ? "✓ Copiado!" : "Copiar link"}
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

  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shareButtonRef = useRef<HTMLButtonElement>(null!);
  const shareDropdownRef = useRef<HTMLDivElement>(null!);

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
    if (!uid) { showToast("Faça login para curtir ❤️"); return; }
    if (loadingLike) return;
    setLoadingLike(true);
    try {
      const ref = doc(db, "posts", postId);
      if (liked) {
        await updateDoc(ref, { likes: increment(-1), likedBy: arrayRemove(uid) });
        setLiked(false); setLikeCount((n) => Math.max(0, n - 1));
        setLikedBy((arr) => arr.filter((id) => id !== uid));
      } else {
        await updateDoc(ref, { likes: increment(1), likedBy: arrayUnion(uid) });
        setLiked(true); setLikeCount((n) => n + 1);
        setLikedBy((arr) => [...arr, uid]);
      }
    } catch (err) { console.error(err); }
    setLoadingLike(false);
  }

  async function copiarLink() {
    await navigator.clipboard.writeText(urlAtual);
    setCopiado(true);
    showToast("Link copiado! 🔗");
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
        onDownload: async () => {
          try {
            await updateDoc(doc(db, "posts", postId), { downloads: increment(1) });
            setDownloadCount((n) => n + 1);
          } catch { }
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
    } catch (err) { console.error(err); alert("Erro ao apagar o post."); }
  }

  return (
    <>
      {/* Toast */}
      <div style={{
        position: "fixed", bottom: "1.5rem", left: "50%",
        transform: `translateX(-50%) translateY(${toastVisible ? 0 : "12px"})`,
        background: "var(--bg-elevated)", border: "1px solid var(--emerald-dim)",
        color: "var(--emerald)", fontSize: "0.82rem", fontWeight: 600,
        padding: "8px 20px", borderRadius: "var(--radius-full)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        opacity: toastVisible ? 1 : 0, transition: "all 0.25s ease",
        pointerEvents: "none", zIndex: 998,
      }}>{toastMsg}</div>

      {likesModalAberto && <LikesModal likedBy={likedBy} onClose={() => setLikesModalAberto(false)} />}

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

      <article className="post-detail-card">
        <div className="post-detail-top">
          <span className={`cat-badge ${post.tipo === "sermao" ? "cat-sermao" : "cat-artigo"}`}>
            {post.tipo === "sermao" ? "Sermão" : "Artigo"}
          </span>
          {isAutor && (
            <div className="post-detail-owner-btns">
              <button onClick={() => router.push(`/editar/${postId}`)} className="post-btn-edit">Editar</button>
              <button onClick={handleDelete} className="post-btn-delete">Apagar</button>
            </div>
          )}
        </div>

        <h1 className="post-detail-title">{post.titulo}</h1>

        <div className="post-detail-meta">
          <AuthorAvatar src={fotoAutor} name={nomeExibicao} size={32} />
          <span className="post-detail-autor" onClick={() => { if (post.autorId) router.push(`/perfil/${post.autorId}`); }}>
            {nomeExibicao}
          </span>
          {formatData(post.data) && <><span className="post-detail-sep">·</span><span>{formatData(post.data)}</span></>}
          {post.igreja && <><span className="post-detail-sep">·</span><span>{post.igreja}</span></>}
        </div>

        <hr className="post-detail-divider" />

        <div className="post-detail-content">{post.conteudo}</div>

        {post.tipo === "sermao" ? (
          <p className="post-detail-footer-text">
            {post.igreja
              ? `Sermão pregado na ${post.igreja}${formatData(post.data) ? ` em ${formatData(post.data)}` : ""}`
              : formatData(post.data) ? `Sermão pregado em ${formatData(post.data)}` : ""}
          </p>
        ) : (
          <p className="post-detail-footer-text">
            Artigo publicado por {nomeExibicao}{formatData(post.data) ? ` em ${formatData(post.data)}` : ""}
          </p>
        )}

        <hr className="post-detail-divider" />

        {/* ── Barra de ações ── */}
        <div className="post-detail-actions">

          {/* ❤️ Amei */}
          <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
            <button
              onClick={handleLike} disabled={loadingLike}
              className={`action-btn ${liked ? "liked" : ""}`}
              style={{ fontSize: "0.9rem", padding: "7px 10px" }}
              title={user ? (liked ? "Remover curtida" : "Curtir") : "Faça login para curtir"}
            >
              {liked ? "❤️" : "🤍"} Amei
            </button>
            {likeCount > 0 && (
              <button
                onClick={() => setLikesModalAberto(true)}
                title="Ver quem curtiu"
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: "0.78rem", fontWeight: 700, color: "var(--emerald)",
                  padding: "4px 6px", borderRadius: "var(--radius-sm)", transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
              >
                {likeCount}
              </button>
            )}
          </div>

          {/* 🔗 Compartilhar */}
          <button
            ref={shareButtonRef}
            onClick={() => setCompartilharAberto((v) => !v)}
            className="post-btn-share"
          >
            🔗 Compartilhar
          </button>

          {/* ⬇️ Salvar PDF */}
          <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
            <button
              onClick={handleDownloadPdf} disabled={gerandoPdf}
              className="post-btn-share"
              style={{ opacity: gerandoPdf ? 0.6 : 1 }}
              title="Baixar como PDF"
            >
              {gerandoPdf ? "⏳ Gerando..." : "⬇️ Salvar PDF"}
            </button>
            {downloadCount > 0 && (
              <span style={{
                fontSize: "0.72rem", fontWeight: 700, color: "var(--text-3)", padding: "4px 4px",
              }} title={`${downloadCount} download${downloadCount !== 1 ? "s" : ""}`}>
                {downloadCount}
              </span>
            )}
          </div>

        </div>
      </article>
    </>
  );
}
