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

function typeBadgeColor(tipo: string): string {
  if (tipo === "sermao") return "var(--emerald)";
  if (tipo === "artigo") return "#60a5fa";
  return "#a78bfa";
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ src, name, size = 40 }: { src?: string | null; name: string; size?: number }) {
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

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconPlay({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.14v14l11-7-11-7z" />
    </svg>
  );
}

function IconPause({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
}

function IconClose({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

// ─── MiniPlayer ───────────────────────────────────────────────────────────────

type MiniPlayerProps = {
  onExpand: () => void;
};

export default function MiniPlayer({ onExpand }: MiniPlayerProps) {
  const {
    current,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    toggle,
    close,
  } = useAudioPlayer();

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggle();
    },
    [toggle]
  );

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      close();
    },
    [close]
  );

  if (!current) return null;

  const percent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const accentColor = typeBadgeColor(current.tipo);

  return (
    <>
      {/* Progress bar — very top of the mini player */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: "rgba(255,255,255,0.08)",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${percent}%`,
            background: accentColor,
            transition: "width 0.25s linear",
          }}
        />
      </div>

      {/* Main row — clickable area expands */}
      <div
        onClick={onExpand}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.5rem 1rem",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        {/* Avatar */}
        <Avatar src={current.autorFoto} name={current.autorNome} size={40} />

        {/* Title + author */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: "0.82rem",
              fontWeight: 700,
              color: "var(--text-1, #f0fdf4)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            {current.titulo}
          </p>
          <p
            style={{
              fontSize: "0.7rem",
              color: "var(--text-3, rgba(255,255,255,0.4))",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              margin: 0,
              marginTop: 2,
              lineHeight: 1.3,
            }}
          >
            {current.autorNome}
          </p>
        </div>

        {/* Play/Pause */}
        <button
          onClick={handleToggle}
          disabled={isLoading}
          aria-label={isPlaying ? "Pausar" : "Reproduzir"}
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            border: "none",
            background: accentColor,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: isLoading ? "default" : "pointer",
            opacity: isLoading ? 0.6 : 1,
            flexShrink: 0,
            transition: "transform 0.15s, opacity 0.15s",
            boxShadow: `0 2px 10px ${accentColor}55`,
          }}
          onMouseEnter={(e) => {
            if (!isLoading) e.currentTarget.style.transform = "scale(1.08)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          {isLoading ? (
            <span
              style={{
                width: 14,
                height: 14,
                border: "2px solid rgba(255,255,255,0.3)",
                borderTopColor: "#fff",
                borderRadius: "50%",
                display: "inline-block",
                animation: "mini-spin 0.7s linear infinite",
              }}
            />
          ) : isPlaying ? (
            <IconPause size={16} />
          ) : (
            <IconPlay size={16} />
          )}
        </button>

        {/* Close */}
        <button
          onClick={handleClose}
          aria-label="Fechar player"
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
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--text-1, #f0fdf4)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-3, rgba(255,255,255,0.4))";
          }}
        >
          <IconClose size={14} />
        </button>
      </div>

      <style>{`
        @keyframes mini-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}