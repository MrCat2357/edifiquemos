"use client";

import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useCallback } from "react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getInitials(name: string): string {
  if (!name) return "?";
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function typeBadge(tipo: string): string {
  if (tipo === "sermao") return "Sermão";
  if (tipo === "artigo") return "Estudo";
  if (tipo === "reflexao") return "Reflexão";
  return "";
}

// ─── Ícones SVG ───────────────────────────────────────────────────────────────

function IconPlay({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M8 5.14v14l11-7-11-7z" />
    </svg>
  );
}

function IconPause({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
}

function IconClose({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function IconVolume({ size = 16, muted = false }: { size?: number; muted?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {muted ? (
        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
      ) : (
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
      )}
    </svg>
  );
}

// ─── Avatar do autor ──────────────────────────────────────────────────────────

function AuthorThumb({
  src,
  name,
  size = 40,
}: {
  src?: string | null;
  name: string;
  size?: number;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{
          width: size,
          height: size,
          borderRadius: "var(--radius-sm, 6px)",
          objectFit: "cover",
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "var(--radius-sm, 6px)",
        background: "linear-gradient(135deg, var(--emerald-dark, #064e3b), var(--emerald, #10b981))",
        color: "#fff",
        fontSize: Math.round(size * 0.36) + "px",
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        userSelect: "none",
        letterSpacing: "0.02em",
      }}
    >
      {getInitials(name)}
    </div>
  );
}

// ─── Barra de progresso ───────────────────────────────────────────────────────

function ProgressBar({
  currentTime,
  duration,
  onSeek,
}: {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}) {
  const percent = duration > 0 ? (currentTime / duration) * 100 : 0;

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(ratio * duration);
  }

  return (
    <div
      onClick={handleClick}
      title={`${formatTime(currentTime)} / ${formatTime(duration)}`}
      style={{
        width: "100%",
        height: 3,
        background: "rgba(255,255,255,0.12)",
        borderRadius: 99,
        cursor: duration ? "pointer" : "default",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          height: "100%",
          width: `${percent}%`,
          background: "var(--emerald, #10b981)",
          borderRadius: 99,
          transition: "width 0.25s linear",
        }}
      />
    </div>
  );
}

// ─── GlobalAudioPlayer ────────────────────────────────────────────────────────

export default function GlobalAudioPlayer() {
  const {
    current,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    volume,
    toggle,
    seek,
    setVolume,
    close,
  } = useAudioPlayer();

  const handleVolumeClick = useCallback(() => {
    setVolume(volume > 0 ? 0 : 1);
  }, [volume, setVolume]);

  if (!current) return null;

  const badge = typeBadge(current.tipo);
  const muted = volume === 0;

  return (
    <>
      {/* ── Barra fixa no fundo ─────────────────────────────────────────── */}
      <div
        role="region"
        aria-label="Player de áudio"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 900,
          background: "var(--bg-card, #0f1a12)",
          borderTop: "1px solid var(--border-light, rgba(255,255,255,0.08))",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.45)",
          display: "flex",
          flexDirection: "column",
          userSelect: "none",
        }}
      >
        {/* Progresso no topo da barra */}
        <div style={{ padding: "0 0", lineHeight: 0 }}>
          <ProgressBar currentTime={currentTime} duration={duration} onSeek={seek} />
        </div>

        {/* Conteúdo principal */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.875rem",
            padding: "0.625rem 1.25rem",
            maxWidth: 960,
            margin: "0 auto",
            width: "100%",
          }}
        >
          {/* Thumbnail / avatar */}
          <AuthorThumb src={current.autorFoto} name={current.autorNome} size={40} />

          {/* Título e autor */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              {badge && (
                <span
                  style={{
                    fontSize: "0.6rem",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--emerald, #10b981)",
                    background: "var(--emerald-dim, rgba(16,185,129,0.12))",
                    padding: "1px 6px",
                    borderRadius: 99,
                    flexShrink: 0,
                  }}
                >
                  {badge}
                </span>
              )}
              <span
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  color: "var(--text-1, #f0fdf4)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {current.titulo}
              </span>
            </div>
            <span
              style={{
                fontSize: "0.72rem",
                color: "var(--text-3, rgba(255,255,255,0.4))",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                display: "block",
                marginTop: 1,
              }}
            >
              {current.autorNome}
            </span>
          </div>

          {/* Tempo */}
          <span
            style={{
              fontSize: "0.72rem",
              color: "var(--text-3, rgba(255,255,255,0.4))",
              fontVariantNumeric: "tabular-nums",
              flexShrink: 0,
              display: "flex",
              gap: "2px",
            }}
          >
            <span>{formatTime(currentTime)}</span>
            {duration > 0 && (
              <>
                <span style={{ opacity: 0.4 }}>/</span>
                <span>{formatTime(duration)}</span>
              </>
            )}
          </span>

          {/* Botão play/pause */}
          <button
            onClick={toggle}
            disabled={isLoading}
            aria-label={isPlaying ? "Pausar" : "Reproduzir"}
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              border: "none",
              background: "var(--emerald, #10b981)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: isLoading ? "default" : "pointer",
              opacity: isLoading ? 0.6 : 1,
              flexShrink: 0,
              transition: "opacity 0.15s, transform 0.15s",
              boxShadow: "0 2px 12px rgba(16,185,129,0.35)",
            }}
            onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.transform = "scale(1.08)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
          >
            {isLoading ? (
              <span
                style={{
                  width: 16,
                  height: 16,
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTopColor: "#fff",
                  borderRadius: "50%",
                  display: "inline-block",
                  animation: "audio-spin 0.7s linear infinite",
                }}
              />
            ) : isPlaying ? (
              <IconPause size={18} />
            ) : (
              <IconPlay size={18} />
            )}
          </button>

          {/* Volume */}
          <button
            onClick={handleVolumeClick}
            aria-label={muted ? "Ativar volume" : "Silenciar"}
            title={muted ? "Ativar volume" : "Silenciar"}
            style={{
              background: "none",
              border: "none",
              color: muted ? "var(--text-3, rgba(255,255,255,0.4))" : "var(--text-2, rgba(255,255,255,0.7))",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              padding: "4px",
              flexShrink: 0,
              transition: "color 0.15s",
            }}
          >
            <IconVolume size={16} muted={muted} />
          </button>

          {/* Fechar */}
          <button
            onClick={close}
            aria-label="Fechar player"
            title="Fechar player"
            style={{
              background: "none",
              border: "none",
              color: "var(--text-3, rgba(255,255,255,0.4))",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              padding: "4px",
              flexShrink: 0,
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-1, #f0fdf4)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-3, rgba(255,255,255,0.4))"; }}
          >
            <IconClose size={14} />
          </button>
        </div>
      </div>

      {/* Espaço para não cobrir conteúdo */}
      <div style={{ height: 68 }} />

      <style>{`
        @keyframes audio-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}