"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import {
  doc,
  runTransaction,
  arrayUnion,
  arrayRemove,
  increment,
} from "firebase/firestore";
import dynamic from "next/dynamic";
import type { Reflexao } from "@/lib/reflexoes";
import BannerLogin from "@/components/BannerLogin";

// Carrega o CommentSection apenas quando o painel é aberto
const CommentSection = dynamic(
  () => import("@/components/comments/CommentSection"),
  { ssr: false, loading: () => null }
);

// ── Ícones ────────────────────────────────────────────────────────────────────

function IconHeart({ size = 13, filled = false }: { size?: number; filled?: boolean }) {
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

function IconComment({ size = 13, active = false }: { size?: number; active?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path
        d="M2 3.5A1.5 1.5 0 0 1 3.5 2h9A1.5 1.5 0 0 1 14 3.5v6A1.5 1.5 0 0 1 12.5 11H9l-3 3v-3H3.5A1.5 1.5 0 0 1 2 9.5v-6Z"
        stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round"
        fill={active ? "currentColor" : "none"}
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

type Props = {
  reflexao: Reflexao;
  hideActions?: boolean;
};

export default function CardReflexao({ reflexao, hideActions = false }: Props) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);

  // Reflexões vivem em /posts/{id} — mesma coleção que sermões e artigos
  const uid = auth.currentUser?.uid ?? null;
  const [likes, setLikes] = useState<number>(reflexao.likes ?? 0);
  const [likedBy, setLikedBy] = useState<string[]>(reflexao.likedBy ?? []);
  const [likePending, setLikePending] = useState(false);

  // Painel de comentários
  const [showComments, setShowComments] = useState(false);
  const [showLoginBanner, setShowLoginBanner] = useState(false);
  const [commentCount, setCommentCount] = useState<number>(reflexao.commentCount ?? 0);

  const jaAmei = uid ? likedBy.includes(uid) : false;

  const href = `/${reflexao.autorSlug}/reflexao/${reflexao.slug}`;
  const borderColor = hovered ? "var(--emerald-dim)" : "var(--border-light)";
  // Quando o painel de comentários está aberto, o card não deve ter radius embaixo
  const hasPanel = showComments || showLoginBanner;

  async function handleLike(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (likePending) return;

    if (!uid) {
      router.push(`/entrar?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
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

  function handleComment(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!uid) {
      router.push(`/entrar?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }

    setShowComments((v) => !v);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* ── Card principal (Link) ─────────────────────────────────────────── */}
      <Link
        href={href}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          padding: "1.125rem",
          borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
          background: hovered ? "var(--bg-card)" : "var(--bg-elevated)",
          borderTop: `1px solid ${borderColor}`,
          borderRight: `1px solid ${borderColor}`,
          borderLeft: `1px solid ${borderColor}`,
          borderBottom: "none",
          boxShadow: hovered ? "0 4px 20px rgba(0,0,0,0.08)" : "none",
          textDecoration: "none",
          transition: "all 0.2s cubic-bezier(0.4,0,0.2,1)",
          cursor: "pointer",
        }}
      >
        {/* Imagem de capa */}
        {reflexao.imagemCapa && (
          <div style={{
            width: "100%", aspectRatio: "16/7",
            borderRadius: "var(--radius-md)", overflow: "hidden", flexShrink: 0,
          }}>
            <img
              src={reflexao.imagemCapa}
              alt={reflexao.titulo}
              style={{
                width: "100%", height: "100%", objectFit: "cover",
                transition: "transform 0.3s ease",
                transform: hovered ? "scale(1.03)" : "scale(1)",
              }}
            />
          </div>
        )}

        {/* Badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{
            fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em",
            textTransform: "uppercase", color: "var(--emerald)",
            background: "var(--emerald-dim)", padding: "2px 8px",
            borderRadius: "var(--radius-full)",
          }}>
            Reflexão
          </span>
        </div>

        {/* Título */}
        <p style={{
          fontSize: "0.975rem", fontWeight: 700, color: "var(--text-1)",
          lineHeight: 1.4, margin: 0,
        }}>
          {reflexao.titulo}
        </p>

        {/* Frase instigadora */}
        <p style={{
          fontSize: "0.82rem", color: "var(--text-2)", lineHeight: 1.55, margin: 0,
          display: "-webkit-box", WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          {reflexao.fraseInstigadora}
        </p>

        {/* Pergunta reflexiva */}
        <p style={{
          fontSize: "0.75rem", color: "var(--text-3)",
          fontStyle: "italic", margin: 0, lineHeight: 1.4,
        }}>
          {reflexao.perguntaReflexiva}
        </p>
      </Link>

      {/* ── Rodapé: Amei + Comentar ──────────────────────────────────────── */}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={(e) => e.stopPropagation()}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.375rem",
          padding: "0.5rem 0.875rem",
          borderTop: "1px solid var(--border-light)",
          borderLeft: `1px solid ${borderColor}`,
          borderRight: `1px solid ${borderColor}`,
          // Se o painel está aberto, não fecha o card aqui (sem radius e sem border-bottom)
          borderBottom: hasPanel ? "none" : `1px solid ${borderColor}`,
          borderRadius: hasPanel ? "0" : `0 0 var(--radius-lg) var(--radius-lg)`,
          background: hovered ? "var(--bg-card)" : "var(--bg-elevated)",
          transition: "all 0.2s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {/* Amei */}
        <button
          onClick={handleLike}
          disabled={likePending}
          aria-label={jaAmei ? "Remover curtida" : "Curtir"}
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.3rem",
            padding: "4px 10px", borderRadius: "var(--radius-full)",
            border: "1px solid",
            borderColor: jaAmei ? "var(--emerald-dim)" : "transparent",
            background: jaAmei ? "var(--emerald-dim)" : "transparent",
            color: jaAmei ? "var(--emerald)" : "var(--text-3)",
            fontSize: "0.75rem", fontWeight: 600,
            cursor: likePending ? "default" : "pointer",
            opacity: likePending ? 0.7 : 1,
            transition: "all 0.18s ease",
          }}
        >
          <IconHeart size={12} filled={jaAmei} />
          <span>{likes > 0 ? likes : "Amei"}</span>
        </button>

        {/* Comentar */}
        <button
          onClick={handleComment}
          aria-label="Comentar"
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.3rem",
            padding: "4px 10px", borderRadius: "var(--radius-full)",
            border: "1px solid",
            borderColor: showComments ? "var(--emerald-dim)" : "transparent",
            background: showComments ? "var(--emerald-dim)" : "transparent",
            color: showComments ? "var(--emerald)" : "var(--text-3)",
            fontSize: "0.75rem", fontWeight: 600,
            cursor: "pointer", transition: "all 0.18s ease",
          }}
        >
          <IconComment size={12} active={showComments} />
          <span>{commentCount > 0 ? commentCount : "Comentar"}</span>
        </button>
      </div>

      {/* ── Banner de login (quando não logado e clicou em Comentar) ─────── */}
      {showLoginBanner && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            borderLeft: `1px solid ${borderColor}`,
            borderRight: `1px solid ${borderColor}`,
            borderBottom: `1px solid ${borderColor}`,
            borderRadius: `0 0 var(--radius-lg) var(--radius-lg)`,
            padding: "0.75rem 1rem",
            background: "var(--bg-elevated)",
          }}
        >
          <BannerLogin onClose={() => setShowLoginBanner(false)} />
        </div>
      )}

      {/* ── Painel de comentários colapsável ─────────────────────────────── */}
      {showComments && reflexao.id && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            borderLeft: `1px solid ${borderColor}`,
            borderRight: `1px solid ${borderColor}`,
            borderBottom: `1px solid ${borderColor}`,
            borderRadius: `0 0 var(--radius-lg) var(--radius-lg)`,
            padding: "1.25rem 1.125rem 1.5rem",
            background: "var(--bg-elevated)",
          }}
        >
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