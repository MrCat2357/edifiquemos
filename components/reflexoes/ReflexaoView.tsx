"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import {
  doc,
  deleteDoc,
  runTransaction,
  arrayUnion,
  arrayRemove,
  increment,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import type { Reflexao } from "@/lib/reflexoes";
import CompartilharWhatsapp from "@/components/reflexoes/CompartilharWhatsapp";
import BannerLogin from "@/components/BannerLogin";
import dynamic from "next/dynamic";

// Carregado de forma lazy para não bloquear o render inicial
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

// ─────────────────────────────────────────────────────────────────────────────

type Props = {
  reflexao: Reflexao;
  autorSlug: string;
};

export default function ReflexaoView({ reflexao, autorSlug }: Props) {
  const router = useRouter();
  const [isOwner, setIsOwner] = useState(false);
  const [deletando, setDeletando] = useState(false);

  // ── Curtidas ──────────────────────────────────────────────────────────────
  // Reflexões vivem em /posts/{id} — mesma coleção que sermões e artigos
  const uid = auth.currentUser?.uid ?? null;
  const [likes, setLikes] = useState<number>(reflexao.likes ?? 0);
  const [likedBy, setLikedBy] = useState<string[]>(reflexao.likedBy ?? []);
  const [likePending, setLikePending] = useState(false);

  // ── Comentários ───────────────────────────────────────────────────────────
  const [commentCount, setCommentCount] = useState<number>(reflexao.commentCount ?? 0);
  const [showLoginBanner, setShowLoginBanner] = useState(false);

  const jaAmei = uid ? likedBy.includes(uid) : false;

  // Detecta se o visitante é o autor desta reflexão
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
      await deleteDoc(doc(db, "posts", reflexao.id)); // reflexões vivem em /posts
      router.push(`/perfil/${autorSlug}`);
    } catch (err) {
      console.error(err);
      setDeletando(false);
    }
  }

  async function handleLike() {
    if (likePending) return;

    if (!uid) {
      setShowLoginBanner(true);
      return;
    }

    if (!reflexao.id) return;
    setLikePending(true);

    const novoJaAmei = !jaAmei;
    setLikedBy((prev) => novoJaAmei ? [...prev, uid] : prev.filter((id) => id !== uid));
    setLikes((prev) => prev + (novoJaAmei ? 1 : -1));

    try {
      await runTransaction(db, async (transaction) => {
        const ref = doc(db, "posts", reflexao.id!); // /posts — coleção correta
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
      // Reverte o estado otimista em caso de erro
      setLikedBy((prev) => novoJaAmei ? prev.filter((id) => id !== uid) : [...prev, uid]);
      setLikes((prev) => prev + (novoJaAmei ? -1 : 1));
    } finally {
      setLikePending(false);
    }
  }

  function handleScrollToComments() {
    // Usuário não logado: mostra banner inline em vez de redirecionar
    if (!uid) {
      setShowLoginBanner(true);
      setTimeout(() => {
        document.getElementById("reflexao-comments-banner")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      return;
    }
    setShowLoginBanner(false);
    document
      .getElementById("reflexao-comments")
      ?.scrollIntoView({ behavior: "smooth" });
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

      {/* ── Barra de ações do autor ─────────────────────────────────── */}
      {isOwner && (
        <div style={{
          display: "flex",
          gap: "0.625rem",
          padding: "0.875rem 1.125rem",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          alignItems: "center",
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
            width: "100%",
            borderRadius: "var(--radius-xl)",
            overflow: "hidden",
            aspectRatio: "1200/630",
            background: "var(--bg-elevated)",
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
          alignSelf: "flex-start",
          fontSize: "0.65rem",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--emerald)",
          background: "var(--emerald-dim)",
          padding: "3px 10px",
          borderRadius: "var(--radius-full)",
        }}>
          Reflexão
        </span>
        <h1 style={{
          fontSize: "clamp(1.5rem, 4vw, 2rem)",
          fontWeight: 800,
          color: "var(--text-1)",
          lineHeight: 1.2,
          margin: 0,
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
        margin: 0,
        padding: "1.25rem 1.5rem",
        borderLeft: "3px solid var(--emerald)",
        background: "var(--bg-elevated)",
        borderRadius: "0 var(--radius-md) var(--radius-md) 0",
      }}>
        <p style={{
          fontSize: "1.05rem",
          fontStyle: "italic",
          color: "var(--text-1)",
          lineHeight: 1.6,
          margin: 0,
          fontWeight: 500,
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
        padding: "1.5rem",
        borderRadius: "var(--radius-lg)",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-light)",
        display: "flex",
        flexDirection: "column",
        gap: "0.625rem",
      }}>
        <span style={{
          fontSize: "0.65rem",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-3)",
        }}>
          Para refletir
        </span>
        <p style={{ fontSize: "1rem", color: "var(--text-1)", fontWeight: 600, lineHeight: 1.5, margin: 0 }}>
          {reflexao.perguntaReflexiva}
        </p>
      </div>

      {/* ── Amei + Comentar ───────────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.875rem 1.125rem",
        borderRadius: "var(--radius-lg)",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-light)",
      }}>
        {/* Botão Amei */}
        <button
          onClick={handleLike}
          disabled={likePending}
          aria-label={jaAmei ? "Remover curtida" : "Curtir reflexão"}
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.4rem",
            padding: "6px 14px", borderRadius: "var(--radius-full)",
            border: "1px solid",
            borderColor: jaAmei ? "var(--emerald-dim)" : "var(--border-light)",
            background: jaAmei ? "var(--emerald-dim)" : "transparent",
            color: jaAmei ? "var(--emerald)" : "var(--text-3)",
            fontSize: "0.82rem", fontWeight: 600,
            cursor: likePending ? "default" : "pointer",
            opacity: likePending ? 0.7 : 1,
            transition: "all 0.2s cubic-bezier(0.4,0,0.2,1)",
            fontFamily: "inherit",
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

        {/* Botão Comentar — rola até a seção de comentários */}
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
            <span style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>
              {commentCount}
            </span>
          )}
        </button>
      </div>

      {/* Banner de login inline (ao clicar Comentar sem estar logado) */}
      {showLoginBanner && (
        <div id="reflexao-comments-banner">
          <BannerLogin onClose={() => setShowLoginBanner(false)} />
        </div>
      )}

      {/* ── Compartilhar no WhatsApp ── */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        padding: "1.5rem",
        borderRadius: "var(--radius-lg)",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
      }}>
        <p style={{
          fontSize: "0.82rem",
          color: "var(--text-3)",
          margin: 0,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
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

      {/* ── Separador ── */}
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
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "var(--emerald)",
              textDecoration: "none",
              padding: "10px 16px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-light)",
              borderRadius: "var(--radius-md)",
              transition: "border-color 0.15s",
            }}
          >
            {origemLabel}
          </Link>
        </div>
      )}

      {/* ── Seção de comentários ──────────────────────────────────────────── */}
      {/*
        Reflexões ficam em /posts/{id} — os comentários ficam em /posts/{id}/comments.
        Por isso usamos collectionRoot="posts" (padrão do CommentSection).
        NÃO usar "reflexoes" aqui — a coleção correta é "posts".
      */}
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