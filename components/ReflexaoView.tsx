"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, deleteDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import type { Reflexao } from "@/lib/reflexoes";
import CompartilharWhatsapp from "@/components/reflexoes/CompartilharWhatsapp";

type Props = {
  reflexao: Reflexao;
  autorSlug: string;
};

export default function ReflexaoView({ reflexao, autorSlug }: Props) {
  const router = useRouter();
  const [isOwner, setIsOwner] = useState(false);
  const [deletando, setDeletando] = useState(false);

  // Detecta se o visitante é o autor desta reflexão
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (uid && reflexao.autorId && uid === reflexao.autorId) {
      setIsOwner(true);
    }
  }, [reflexao.autorId]);

  async function handleDeletar() {
    if (!reflexao.id) return;
    if (!confirm("Tem certeza que deseja apagar esta reflexão?")) return;
    setDeletando(true);
    try {
      await deleteDoc(doc(db, "reflexoes", reflexao.id));
      router.push(`/perfil/${autorSlug}`);
    } catch (err) {
      console.error(err);
      setDeletando(false);
    }
  }

  const paragrafos = reflexao.conteudo
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const origemHref =
    reflexao.publicacaoOrigemTipo === "artigo"
      ? `/posts/artigos/${reflexao.publicacaoOrigemSlug}`
      : `/posts/sermoes/${reflexao.publicacaoOrigemSlug}`;

  const origemLabel =
    reflexao.publicacaoOrigemTipo === "artigo"
      ? "→ Ler o artigo completo"
      : "→ Ler o sermão completo";

  const temAtribuicao =
    reflexao.imagemFotografoNome &&
    reflexao.imagemFotografoUrl &&
    reflexao.imagemUnsplashUrl;

  return (
    <div
      style={{
        maxWidth: 680,
        margin: "0 auto",
        padding: "2rem 1.25rem 4rem",
        display: "flex",
        flexDirection: "column",
        gap: "2rem",
      }}
    >
      {/* ── Barra de ações do autor ─────────────────────────────────── */}
      {isOwner && (
        <div
          style={{
            display: "flex",
            gap: "0.625rem",
            padding: "0.875rem 1.125rem",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: "0.78rem",
              color: "var(--text-3)",
              fontWeight: 600,
              flex: 1,
            }}
          >
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
            style={{
              fontSize: "0.78rem",
              padding: "6px 14px",
              opacity: deletando ? 0.6 : 1,
            }}
          >
            {deletando ? "Apagando..." : "🗑 Apagar"}
          </button>
        </div>
      )}

      {/* ── Imagem de capa ── */}
      {reflexao.imagemCapa && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <div
            style={{
              width: "100%",
              borderRadius: "var(--radius-xl)",
              overflow: "hidden",
              aspectRatio: "1200/630",
              background: "var(--bg-elevated)",
            }}
          >
            <img
              src={reflexao.imagemCapa}
              alt={reflexao.titulo}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          </div>
          {temAtribuicao && (
            <p
              style={{
                fontSize: "0.7rem",
                color: "var(--text-3)",
                margin: 0,
                textAlign: "right",
              }}
            >
              Foto por{" "}
              <a
                href={reflexao.imagemFotografoUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--text-3)", textDecoration: "underline" }}
              >
                {reflexao.imagemFotografoNome}
              </a>{" "}
              no{" "}
              <a
                href={reflexao.imagemUnsplashUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--text-3)", textDecoration: "underline" }}
              >
                Unsplash
              </a>
            </p>
          )}
        </div>
      )}

      {/* ── Cabeçalho ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <span
          style={{
            alignSelf: "flex-start",
            fontSize: "0.65rem",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--emerald)",
            background: "var(--emerald-dim)",
            padding: "3px 10px",
            borderRadius: "var(--radius-full)",
          }}
        >
          Reflexão
        </span>
        <h1
          style={{
            fontSize: "clamp(1.5rem, 4vw, 2rem)",
            fontWeight: 800,
            color: "var(--text-1)",
            lineHeight: 1.2,
            margin: 0,
          }}
        >
          {reflexao.titulo}
        </h1>
        <p style={{ fontSize: "0.85rem", color: "var(--text-3)", margin: 0 }}>
          Por{" "}
          <Link
            href={`/perfil/${autorSlug}`}
            style={{ color: "var(--emerald)", textDecoration: "none" }}
          >
            {reflexao.autorNome}
          </Link>
        </p>
      </div>

      {/* ── Frase instigadora ── */}
      <blockquote
        style={{
          margin: 0,
          padding: "1.25rem 1.5rem",
          borderLeft: "3px solid var(--emerald)",
          background: "var(--bg-elevated)",
          borderRadius: "0 var(--radius-md) var(--radius-md) 0",
        }}
      >
        <p
          style={{
            fontSize: "1.05rem",
            fontStyle: "italic",
            color: "var(--text-1)",
            lineHeight: 1.6,
            margin: 0,
            fontWeight: 500,
          }}
        >
          {reflexao.fraseInstigadora}
        </p>
      </blockquote>

      {/* ── Conteúdo ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {paragrafos.map((p, i) => (
          <p
            key={i}
            style={{
              fontSize: "1rem",
              color: "var(--text-2)",
              lineHeight: 1.75,
              margin: 0,
            }}
          >
            {p}
          </p>
        ))}
      </div>

      {/* ── Pergunta reflexiva ── */}
      <div
        style={{
          padding: "1.5rem",
          borderRadius: "var(--radius-lg)",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-light)",
          display: "flex",
          flexDirection: "column",
          gap: "0.625rem",
        }}
      >
        <span
          style={{
            fontSize: "0.65rem",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--text-3)",
          }}
        >
          Para refletir
        </span>
        <p
          style={{
            fontSize: "1rem",
            color: "var(--text-1)",
            fontWeight: 600,
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          {reflexao.perguntaReflexiva}
        </p>
      </div>

      {/* ── Compartilhar no WhatsApp ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          padding: "1.5rem",
          borderRadius: "var(--radius-lg)",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
        }}
      >
        <p
          style={{
            fontSize: "0.82rem",
            color: "var(--text-3)",
            margin: 0,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Compartilhe com seu grupo
        </p>
        <p
          style={{
            fontSize: "0.85rem",
            color: "var(--text-2)",
            margin: 0,
            lineHeight: 1.5,
          }}
        >
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
    </div>
  );
}