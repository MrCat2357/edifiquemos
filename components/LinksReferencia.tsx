"use client";

import { useState } from "react";

export type LinkReferencia = {
  label: string;
  url: string;
  tipo: "youtube" | "blog" | "livro" | "site" | "outro";
};

const TIPO_CONFIG: Record<
  LinkReferencia["tipo"],
  { icon: string; cor: string; corTexto: string; corBorda: string; corGlow: string }
> = {
  youtube: {
    icon: "▶",
    cor: "linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)",
    corTexto: "#fca5a5",
    corBorda: "rgba(239,68,68,0.25)",
    corGlow: "rgba(239,68,68,0.12)",
  },
  blog: {
    icon: "✍",
    cor: "linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%)",
    corTexto: "#93c5fd",
    corBorda: "rgba(59,130,246,0.25)",
    corGlow: "rgba(59,130,246,0.10)",
  },
  livro: {
    icon: "📖",
    cor: "linear-gradient(135deg, #451a03 0%, #92400e 100%)",
    corTexto: "#fcd34d",
    corBorda: "rgba(245,158,11,0.30)",
    corGlow: "rgba(245,158,11,0.12)",
  },
  site: {
    icon: "🌐",
    cor: "linear-gradient(135deg, #064e35 0%, #059669 100%)",
    corTexto: "#6ee7b7",
    corBorda: "rgba(16,185,129,0.25)",
    corGlow: "rgba(16,185,129,0.10)",
  },
  outro: {
    icon: "🔗",
    cor: "linear-gradient(135deg, #1f1f2e 0%, #2d2d44 100%)",
    corTexto: "#c4b5fd",
    corBorda: "rgba(139,92,246,0.25)",
    corGlow: "rgba(139,92,246,0.10)",
  },
};

function normalizeUrl(url: string): string {
  if (!url) return "#";
  if (/^https?:\/\//i.test(url)) return url;
  return "https://" + url;
}

export default function LinksReferencia({ links }: { links: LinkReferencia[] }) {
  if (!links || links.length === 0) return null;

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: "0.625rem",
      margin: "1.5rem 0 0.5rem",
    }}>
      <p style={{
        fontSize: "0.68rem",
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "var(--text-3)",
        marginBottom: "0.25rem",
      }}>
        Referências & Links
      </p>

      {links.map((link, i) => {
        const cfg = TIPO_CONFIG[link.tipo] ?? TIPO_CONFIG.outro;
        return (
          <LinkCard key={i} link={link} cfg={cfg} />
        );
      })}
    </div>
  );
}

function LinkCard({
  link,
  cfg,
}: {
  link: LinkReferencia;
  cfg: (typeof TIPO_CONFIG)[keyof typeof TIPO_CONFIG];
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <a
      href={normalizeUrl(link.url)}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "1rem",
        padding: "0.875rem 1.125rem",
        borderRadius: "var(--radius-lg)",
        background: hovered ? cfg.cor : "var(--bg-elevated)",
        border: `1px solid ${hovered ? cfg.corBorda : "var(--border-light)"}`,
        boxShadow: hovered ? `0 4px 24px ${cfg.corGlow}, inset 0 1px 0 rgba(255,255,255,0.04)` : "none",
        textDecoration: "none",
        transition: "all 0.22s cubic-bezier(0.4,0,0.2,1)",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Glow de fundo sutil */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: cfg.cor,
        opacity: hovered ? 0 : 0.06,
        transition: "opacity 0.22s",
        pointerEvents: "none",
        borderRadius: "inherit",
      }} />

      {/* Ícone */}
      <div style={{
        width: 40,
        height: 40,
        borderRadius: "10px",
        background: cfg.cor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "1.1rem",
        flexShrink: 0,
        boxShadow: `0 2px 12px ${cfg.corGlow}`,
        transition: "transform 0.2s",
        transform: hovered ? "scale(1.08)" : "scale(1)",
      }}>
        {cfg.icon}
      </div>

      {/* Texto */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: "0.9rem",
          fontWeight: 700,
          color: hovered ? "#fff" : "var(--text-1)",
          transition: "color 0.2s",
          marginBottom: "0.2rem",
          lineHeight: 1.3,
        }}>
          {link.label}
        </p>
        <p style={{
          fontSize: "0.72rem",
          color: hovered ? cfg.corTexto : "var(--text-3)",
          transition: "color 0.2s",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {normalizeUrl(link.url)}
        </p>
      </div>

      {/* Seta */}
      <div style={{
        flexShrink: 0,
        fontSize: "1rem",
        color: hovered ? cfg.corTexto : "var(--text-3)",
        transform: hovered ? "translateX(3px)" : "translateX(0)",
        transition: "all 0.2s",
        opacity: hovered ? 1 : 0.5,
      }}>
        →
      </div>
    </a>
  );
}