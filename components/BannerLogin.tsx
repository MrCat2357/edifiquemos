"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export default function BannerLogin({
  onClose,
  redirectTo,
  modal = false,
}: {
  onClose: () => void;
  redirectTo?: string;
  modal?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const currentPath = qs ? `${pathname}?${qs}` : pathname;

  const destino = redirectTo ?? currentPath;
  const href =
    destino && destino !== "/" && !destino.startsWith("/entrar")
      ? `/entrar?next=${encodeURIComponent(destino)}`
      : "/entrar";

  if (modal) {
    return (
      <>
        {/* Overlay */}
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1200,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(3px)",
          }}
        />

        {/* Modal — usa inset em vez de transform para não depender de cálculos */}
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            /* Centraliza via margin auto + inset */
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1201,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",          /* garante margem nas bordas em telas pequenas */
            pointerEvents: "none",    /* deixa cliques no overlay passarem */
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              pointerEvents: "auto",
              position: "relative",
              width: "100%",
              maxWidth: "400px",
              boxSizing: "border-box",
              background: "linear-gradient(135deg, #0d3320, #134d2e)",
              border: "1px solid var(--emerald-dim)",
              borderRadius: "var(--radius-lg)",
              padding: "1.75rem 1.25rem 1.5rem",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.875rem",
              textAlign: "center",
              boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
              animation: "fadeUp 0.2s ease both",
            }}
          >
            {/* Botão fechar */}
            <button
              onClick={onClose}
              aria-label="Fechar"
              style={{
                position: "absolute",
                top: "0.625rem",
                right: "0.625rem",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text-3)",
                fontSize: "1rem",
                lineHeight: 1,
                padding: "4px 8px",
                borderRadius: "var(--radius-sm)",
              }}
            >
              &#x2715;
            </button>

            {/* Ícone de cruz */}
            <div style={{ fontSize: "2rem", lineHeight: 1, marginTop: "0.25rem" }}>
              &#x271D;
            </div>

            {/* Textos */}
            <div style={{ width: "100%" }}>
              <p
                style={{
                  fontSize: "clamp(0.9rem, 4vw, 1rem)",
                  fontWeight: 700,
                  color: "var(--emerald)",
                  marginBottom: "0.4rem",
                  overflowWrap: "break-word",
                  wordBreak: "break-word",
                }}
              >
                Que bom que voc&#xea; est&#xe1; sendo edificado!
              </p>
              <p
                style={{
                  fontSize: "clamp(0.78rem, 3.5vw, 0.85rem)",
                  color: "var(--text-2)",
                  lineHeight: 1.5,
                  overflowWrap: "break-word",
                  wordBreak: "break-word",
                }}
              >
                Para curtir, comentar ou ouvir, entre em nosso ambiente e fa&#xe7;a
                parte desta comunidade.
              </p>
            </div>

            {/* Botão Entrar — largura total do card */}
            <Link
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                padding: "10px 0",
                background: "var(--emerald)",
                color: "#fff",
                borderRadius: "var(--radius-full)",
                fontWeight: 700,
                fontSize: "clamp(0.82rem, 4vw, 0.9rem)",
                textDecoration: "none",
                transition: "background 0.15s",
                boxSizing: "border-box",
              }}
            >
              Entrar
            </Link>
          </div>
        </div>
      </>
    );
  }

  /* ── Modo inline (banner) ───────────────────────────── */
  return (
    <div className="login-banner" role="alert" aria-live="polite">
      <div className="login-banner-icon">&#x271D;</div>
      <div className="login-banner-text">
        <p className="login-banner-title">Que bom que voc&#xea; est&#xe1; sendo edificado!</p>
        <p className="login-banner-sub">
          Para curtir, comentar ou ouvir, entre em nosso ambiente.
        </p>
      </div>
      <Link href={href} className="login-banner-btn">
        Entrar
      </Link>
      <button
        className="login-banner-close"
        onClick={onClose}
        aria-label="Fechar"
      >
        &#x2715;
      </button>
    </div>
  );
}