"use client";

import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useCallback, useRef } from "react";

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

function typeBadge(tipo: string): { label: string; color: string; bg: string } {
  if (tipo === "sermao") return { label: "Sermão", color: "var(--emerald, #10b981)", bg: "var(--emerald-dim, rgba(16,185,129,0.12))" };
  if (tipo === "artigo") return { label: "Estudo", color: "#60a5fa", bg: "rgba(96,165,250,0.12)" };
  return { label: "Reflexão", color: "#a78bfa", bg: "rgba(167,139,250,0.12)" };
}

function accentColor(tipo: string): string {
  if (tipo === "sermao") return "var(--emerald, #10b981)";
  if (tipo === "artigo") return "#60a5fa";
  return "#a78bfa";
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function AvatarLarge({ src, name, size = 200 }: { src?: string | null; name: string; size?: number }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "linear-gradient(135deg, var(--emerald-dark, #064e3b), var(--emerald, #10b981))",
        color: "#fff",
        fontSize: Math.round(size * 0.28) + "px",
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
        letterSpacing: "0.02em",
      }}
    >
      {getInitials(name)}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconPlay({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.14v14l11-7-11-7z" />
    </svg>
  );
}

function IconPause({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
}

function IconSkipPrev({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
    </svg>
  );
}

function IconSkipNext({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 18l8.5-6L6 6v12zM16 6h2v12h-2z" />
    </svg>
  );
}

function IconChevronDown({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function IconVolumeMute({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
    </svg>
  );
}

function IconVolumeOn({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
    </svg>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({
  currentTime,
  duration,
  onSeek,
  accent,
}: {
  currentTime: number;
  duration: number;
  onSeek: (t: number) => void;
  accent: string;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const percent = duration > 0 ? (currentTime / duration) * 100 : 0;

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!duration || !barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(Math.max(0, Math.min(1, ratio)) * duration);
  }

  return (
    <div style={{ width: "100%" }}>
      <div
        ref={barRef}
        onClick={handleClick}
        role="slider"
        aria-valuenow={Math.round(currentTime)}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        style={{
          width: "100%",
          height: 4,
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
            background: accent,
            borderRadius: 99,
            transition: "width 0.25s linear",
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "0.4rem",
          fontSize: "0.72rem",
          color: "var(--text-3, rgba(255,255,255,0.4))",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}

// ─── ExpandedPlayer ───────────────────────────────────────────────────────────

type ExpandedPlayerProps = {
  open: boolean;
  onMinimize: () => void;
};

export default function ExpandedPlayer({ open, onMinimize }: ExpandedPlayerProps) {
  const {
    current,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    volume,
    hasNext,
    hasPrevious,
    toggle,
    seek,
    setVolume,
    playNext,
    playPrevious,
  } = useAudioPlayer();

  const handleVolumeToggle = useCallback(() => {
    setVolume(volume > 0 ? 0 : 1);
  }, [volume, setVolume]);

  if (!current) return null;

  const badge = typeBadge(current.tipo);
  const accent = accentColor(current.tipo);
  const muted = volume === 0;

  return (
    <>
      <div
        style={{
          // Fullscreen fixed overlay
          position: "fixed",
          inset: 0,
          zIndex: 950,
          background: "var(--bg-card, #0f1a12)",
          // Slide-up animation
          transform: open ? "translateY(0)" : "translateY(100%)",
          transition: "transform 320ms cubic-bezier(0.32, 0.72, 0, 1)",
          willChange: "transform",
          // KEY FIX: use flex column with fixed height — NO overflow scroll
          display: "flex",
          flexDirection: "column",
          height: "100dvh", // dynamic viewport height accounts for mobile browser chrome
          overflow: "hidden",
        }}
        aria-hidden={!open}
      >
        {/* Subtle gradient backdrop */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(ellipse at 50% 0%, ${accent}18 0%, transparent 60%)`,
            pointerEvents: "none",
          }}
        />

        {/* ── Header bar — fixed height ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.75rem 1.25rem 0.5rem",
            flexShrink: 0,
            position: "relative",
            zIndex: 1,
          }}
        >
          <button
            onClick={onMinimize}
            aria-label="Minimizar player"
            style={{
              background: "none",
              border: "none",
              color: "var(--text-2, rgba(255,255,255,0.7))",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              padding: "8px",
              borderRadius: "50%",
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "none";
            }}
          >
            <IconChevronDown size={24} />
          </button>

          <span
            style={{
              fontSize: "0.7rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--text-3, rgba(255,255,255,0.4))",
            }}
          >
            Tocando agora
          </span>

          {/* Spacer for symmetry */}
          <div style={{ width: 40 }} />
        </div>

        {/* ── Scrollable content area — fills remaining height ── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            // Horizontal padding; bottom padding for mini-player gap
            padding: "0.5rem 1.5rem 1.25rem",
            gap: "1rem",
            position: "relative",
            zIndex: 1,
            // Distribute space evenly without overflowing
            justifyContent: "space-between",
            minHeight: 0,
          }}
        >
          {/* Cover art — takes available space but won't overflow */}
          <div
            style={{
              // Flex grow but bounded
              flex: "1 1 0",
              minHeight: 0,
              maxHeight: "40vh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                // Square, constrained by both flex height and viewport width
                width: "min(100%, 40vh)",
                aspectRatio: "1",
                borderRadius: "var(--radius-lg, 12px)",
                overflow: "hidden",
                boxShadow: `0 16px 48px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.05)`,
                transition: "transform 0.3s ease",
                transform: isPlaying ? "scale(1.0)" : "scale(0.92)",
              }}
            >
              <AvatarLarge
                src={current.autorFoto}
                name={current.autorNome}
                size={200}
              />
            </div>
          </div>

          {/* Track info row */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "0.75rem",
              flexShrink: 0,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Badge */}
              <span
                style={{
                  display: "inline-block",
                  fontSize: "0.58rem",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: badge.color,
                  background: badge.bg,
                  padding: "2px 8px",
                  borderRadius: 99,
                  marginBottom: "0.35rem",
                }}
              >
                {badge.label}
              </span>

              {/* Title — 2 lines max, then ellipsis */}
              <p
                style={{
                  fontSize: "1rem",
                  fontWeight: 800,
                  color: "var(--text-1, #f0fdf4)",
                  lineHeight: 1.3,
                  margin: 0,
                  marginBottom: "0.2rem",
                  // Clamp to 2 lines
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {current.titulo}
              </p>
              <p
                style={{
                  fontSize: "0.82rem",
                  color: "var(--text-3, rgba(255,255,255,0.4))",
                  margin: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {current.autorNome}
              </p>
            </div>

            {/* Volume toggle */}
            <button
              onClick={handleVolumeToggle}
              aria-label={muted ? "Ativar volume" : "Silenciar"}
              style={{
                background: "none",
                border: "none",
                color: muted
                  ? "var(--text-3, rgba(255,255,255,0.4))"
                  : "var(--text-2, rgba(255,255,255,0.7))",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                padding: "4px",
                flexShrink: 0,
                marginTop: "0.5rem",
                transition: "color 0.15s",
              }}
            >
              {muted ? <IconVolumeMute size={20} /> : <IconVolumeOn size={20} />}
            </button>
          </div>

          {/* Progress bar */}
          <div style={{ flexShrink: 0 }}>
            <ProgressBar
              currentTime={currentTime}
              duration={duration}
              onSeek={seek}
              accent={accent}
            />
          </div>

          {/* Playback controls */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "1.5rem",
              flexShrink: 0,
              paddingBottom: "0.25rem",
            }}
          >
            {/* Previous */}
            <button
              onClick={playPrevious}
              disabled={!hasPrevious}
              aria-label="Anterior"
              style={{
                background: "none",
                border: "none",
                color: hasPrevious
                  ? "var(--text-2, rgba(255,255,255,0.7))"
                  : "rgba(255,255,255,0.15)",
                cursor: hasPrevious ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                padding: "8px",
                transition: "transform 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => {
                if (hasPrevious) e.currentTarget.style.transform = "scale(1.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              <IconSkipPrev size={26} />
            </button>

            {/* Play/Pause */}
            <button
              onClick={toggle}
              disabled={isLoading}
              aria-label={isPlaying ? "Pausar" : "Reproduzir"}
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                border: "none",
                background: accent,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: isLoading ? "default" : "pointer",
                opacity: isLoading ? 0.7 : 1,
                boxShadow: `0 4px 20px ${accent}55`,
                transition: "transform 0.15s, opacity 0.15s, box-shadow 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.transform = "scale(1.06)";
                  e.currentTarget.style.boxShadow = `0 6px 28px ${accent}77`;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow = `0 4px 20px ${accent}55`;
              }}
            >
              {isLoading ? (
                <span
                  style={{
                    width: 22,
                    height: 22,
                    border: "2.5px solid rgba(255,255,255,0.3)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "exp-spin 0.7s linear infinite",
                  }}
                />
              ) : isPlaying ? (
                <IconPause size={28} />
              ) : (
                <IconPlay size={28} />
              )}
            </button>

            {/* Next */}
            <button
              onClick={playNext}
              disabled={!hasNext}
              aria-label="Próximo"
              style={{
                background: "none",
                border: "none",
                color: hasNext
                  ? "var(--text-2, rgba(255,255,255,0.7))"
                  : "rgba(255,255,255,0.15)",
                cursor: hasNext ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                padding: "8px",
                transition: "transform 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => {
                if (hasNext) e.currentTarget.style.transform = "scale(1.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              <IconSkipNext size={26} />
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes exp-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}