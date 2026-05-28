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
        <div
          onClick={onClose}
          style={{
            position: "fixed", inset: 0, zIndex: 1200,
            background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)",
          }}
        />
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            zIndex: 1201,
            transform: "translate(-50%, -50%)",
            /* Clamp width: at least 300px, at most 400px, never wider than 92vw */
            width: "min(92vw, 400px)",
            minWidth: 0,
            maxWidth: "calc(100vw - 2rem)",
            boxSizing: "border-box",
            background: "linear-gradient(135deg, #0d3320, #134d2e)",
            border: "1px solid var(--emerald-dim)",
            borderRadius: "var(--radius-lg)",
            /* Reduced padding on the right to give room for the close button */
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
          {/* Close button — absolutely positioned inside the dialog */}
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
              /* Prevent the button itself from stretching the modal */
              flexShrink: 0,
            }}
          >
            &#x2715;
          </button>

          <div style={{ fontSize: "2rem", lineHeight: 1, marginTop: "0.25rem" }}>
            &#x271D;
          </div>

          <div style={{ width: "100%", minWidth: 0 }}>
            <p
              style={{
                fontSize: "clamp(0.9rem, 4vw, 1rem)",
                fontWeight: 700,
                color: "var(--emerald)",
                marginBottom: "0.4rem",
                /* Allow text to wrap instead of overflowing */
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

          <Link
            href={href}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              /* Full width of the modal's content area */
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
              /* Never let the button shrink below its content */
              flexShrink: 0,
            }}
          >
            Entrar
          </Link>
        </div>
      </>
    );
  }

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