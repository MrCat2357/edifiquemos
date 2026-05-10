"use client";

import { useState } from "react";
import Link from "next/link";
import type { Reflexao } from "@/lib/reflexoes";

type Props = {
  reflexao: Reflexao;
};

export default function CardReflexao({ reflexao }: Props) {
  const [hovered, setHovered] = useState(false);

  const href = `/${reflexao.autorSlug}/reflexao/${reflexao.slug}`;

  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        padding: "1.125rem",
        borderRadius: "var(--radius-lg)",
        background: hovered ? "var(--bg-card)" : "var(--bg-elevated)",
        border: `1px solid ${hovered ? "var(--emerald-dim)" : "var(--border-light)"}`,
        boxShadow: hovered ? "0 4px 20px rgba(0,0,0,0.08)" : "none",
        textDecoration: "none",
        transition: "all 0.2s cubic-bezier(0.4,0,0.2,1)",
        cursor: "pointer",
      }}
    >
      {/* Imagem de capa */}
      {reflexao.imagemCapa && (
        <div style={{
          width: "100%",
          aspectRatio: "16/7",
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
          flexShrink: 0,
        }}>
          <img
            src={reflexao.imagemCapa}
            alt={reflexao.titulo}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transition: "transform 0.3s ease",
              transform: hovered ? "scale(1.03)" : "scale(1)",
            }}
          />
        </div>
      )}

      {/* Badge */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{
          fontSize: "0.65rem",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--emerald)",
          background: "var(--emerald-dim)",
          padding: "2px 8px",
          borderRadius: "var(--radius-full)",
        }}>
          Reflexão
        </span>
      </div>

      {/* Título */}
      <p style={{
        fontSize: "0.975rem",
        fontWeight: 700,
        color: "var(--text-1)",
        lineHeight: 1.4,
        margin: 0,
      }}>
        {reflexao.titulo}
      </p>

      {/* Frase instigadora */}
      <p style={{
        fontSize: "0.82rem",
        color: "var(--text-2)",
        lineHeight: 1.55,
        margin: 0,
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}>
        {reflexao.fraseInstigadora}
      </p>

      {/* Rodapé: pergunta reflexiva */}
      <p style={{
        fontSize: "0.75rem",
        color: "var(--text-3)",
        fontStyle: "italic",
        margin: 0,
        lineHeight: 1.4,
      }}>
        {reflexao.perguntaReflexiva}
      </p>
    </Link>
  );
}