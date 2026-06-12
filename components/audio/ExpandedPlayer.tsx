"use client";

import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useCallback, useRef, useState } from "react";
import type { PlaybackSpeed, HistoryItem, SleepTimerMode } from "@/providers/AudioProvider";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatRemaining(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `-${m}:${s.toString().padStart(2, "0")}`;
}

function formatSleepRemaining(seconds: number): string {
  if (seconds >= 60) return `${Math.ceil(seconds / 60)}min`;
  return `${seconds}s`;
}

function getInitials(name: string): string {
  if (!name) return "?";
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
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
    return <img src={src} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />;
  }
  return (
    <div style={{
      width: "100%", height: "100%",
      background: "linear-gradient(135deg, var(--emerald-dark, #064e3b), var(--emerald, #10b981))",
      color: "#fff", fontSize: Math.round(size * 0.28) + "px", fontWeight: 700,
      display: "flex", alignItems: "center", justifyContent: "center",
      userSelect: "none", letterSpacing: "0.02em",
    }}>
      {getInitials(name)}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconPlay({ size = 28 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.14v14l11-7-11-7z" /></svg>;
}
function IconPause({ size = 28 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>;
}
function IconSkipPrev({ size = 22 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" /></svg>;
}
function IconSkipNext({ size = 22 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 18l8.5-6L6 6v12zM16 6h2v12h-2z" /></svg>;
}
function IconChevronDown({ size = 24 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>;
}
function IconVolumeMute({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></svg>;
}
function IconVolumeOn({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>;
}
function IconMoon({ size = 13 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>;
}
function IconHistory({ size = 15 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/><polyline points="12 7 12 12 15 15"/></svg>;
}
function IconQueue({ size = 15 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>;
}
function IconPlayerPlay({ size = 15 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.14v14l11-7-11-7z" /></svg>;
}

// ─── ProgressBar ──────────────────────────────────────────────────────────────

function ProgressBar({
  currentTime, duration, onSeek, accent,
}: {
  currentTime: number; duration: number; onSeek: (t: number) => void; accent: string;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const percent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const remaining = duration > 0 ? Math.max(0, duration - currentTime) : null;

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!duration || !barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    onSeek(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration);
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
          width: "100%", height: 4, background: "rgba(255,255,255,0.12)",
          borderRadius: 99, cursor: duration ? "pointer" : "default",
          position: "relative", overflow: "hidden",
        }}
      >
        <div style={{
          position: "absolute", top: 0, left: 0, height: "100%",
          width: `${percent}%`, background: accent, borderRadius: 99,
          transition: "width 0.25s linear",
        }} />
      </div>
      <div style={{
        display: "flex", justifyContent: "space-between", marginTop: "0.4rem",
        fontSize: "0.72rem", color: "var(--text-3, rgba(255,255,255,0.4))",
        fontVariantNumeric: "tabular-nums",
      }}>
        <span>{formatTime(currentTime)}</span>
        {remaining !== null && (
          <span style={{ color: "rgba(255,255,255,0.25)" }}>{formatRemaining(remaining)}</span>
        )}
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}

// ─── SpeedControl ─────────────────────────────────────────────────────────────

const ALL_SPEEDS: PlaybackSpeed[] = [0.5, 0.75, 1, 1.5, 2];
const WINDOW_SIZE = 3;

function initialWindowStart(speed: PlaybackSpeed): number {
  const idx = ALL_SPEEDS.indexOf(speed);
  if (idx < 0) return 0;
  const ideal = idx - 1;
  return Math.max(0, Math.min(ideal, ALL_SPEEDS.length - WINDOW_SIZE));
}

function SpeedControl({ speed, onChange }: { speed: PlaybackSpeed; onChange: (s: PlaybackSpeed) => void }) {
  const [windowStart, setWindowStart] = useState(() => initialWindowStart(speed));

  const canLeft  = windowStart > 0;
  const canRight = windowStart < ALL_SPEEDS.length - WINDOW_SIZE;
  const visible  = ALL_SPEEDS.slice(windowStart, windowStart + WINDOW_SIZE);

  const arrowStyle = (enabled: boolean): React.CSSProperties => ({
    display: "flex", alignItems: "center", justifyContent: "center",
    width: 20, height: 20, borderRadius: "50%", border: "1px solid",
    borderColor: enabled ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.06)",
    background: "transparent",
    color: enabled ? "var(--text-2, rgba(255,255,255,0.7))" : "rgba(255,255,255,0.15)",
    cursor: enabled ? "pointer" : "default",
    fontSize: "0.75rem", fontWeight: 700, fontFamily: "inherit",
    transition: "all 0.15s", flexShrink: 0, padding: 0, lineHeight: 1,
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
      <span style={{
        fontSize: "0.62rem", fontWeight: 600, color: "var(--text-3, rgba(255,255,255,0.4))",
        letterSpacing: "0.06em", textTransform: "uppercase", marginRight: "0.1rem",
      }}>
        Vel.
      </span>

      <button
        onClick={() => canLeft && setWindowStart((w) => w - 1)}
        disabled={!canLeft}
        aria-label="Velocidades anteriores"
        style={arrowStyle(canLeft)}
      >
        ‹
      </button>

      {visible.map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          aria-label={`Velocidade ${s}x`}
          aria-pressed={speed === s}
          style={{
            padding: "4px 10px", borderRadius: 99, border: "1px solid",
            borderColor: speed === s ? "currentColor" : "rgba(255,255,255,0.1)",
            background: speed === s ? "rgba(255,255,255,0.1)" : "transparent",
            color: speed === s ? "var(--text-1, #f0fdf4)" : "var(--text-3, rgba(255,255,255,0.4))",
            fontSize: "0.72rem", fontWeight: 700, cursor: "pointer",
            transition: "all 0.15s", fontFamily: "inherit",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {s}×
        </button>
      ))}

      <button
        onClick={() => canRight && setWindowStart((w) => w + 1)}
        disabled={!canRight}
        aria-label="Próximas velocidades"
        style={arrowStyle(canRight)}
      >
        ›
      </button>
    </div>
  );
}

// ─── SleepTimerControl ────────────────────────────────────────────────────────

function SleepTimerControl({
  sleepTimer, sleepTimerRemaining, onSet, onCancel,
}: {
  sleepTimer: SleepTimerMode;
  sleepTimerRemaining: number | null;
  onSet: (val: number | "end") => void;
  onCancel: () => void;
}) {
  const [open, setOpen] = useState(false);
  const active = sleepTimer.type !== "off";

  const label = active
    ? sleepTimer.type === "end_of_track"
      ? "Fim da faixa"
      : sleepTimerRemaining !== null
      ? formatSleepRemaining(sleepTimerRemaining)
      : "Ativo"
    : null;

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Sleep timer"
        style={{
          display: "flex", alignItems: "center", gap: "5px",
          padding: "4px 10px", borderRadius: 99, border: "1px solid",
          borderColor: active ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.1)",
          background: active ? "rgba(255,255,255,0.08)" : "transparent",
          color: active ? "var(--text-1, #f0fdf4)" : "var(--text-3, rgba(255,255,255,0.4))",
          fontSize: "0.72rem", fontWeight: 600, cursor: "pointer",
          transition: "all 0.15s", fontFamily: "inherit",
        }}
      >
        <IconMoon size={13} />
        {label ?? "Timer"}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10 }} />
          <div style={{
            position: "absolute", bottom: "calc(100% + 8px)", right: 0,
            background: "var(--bg-elevated, #111a13)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "var(--radius-lg, 12px)", padding: "0.5rem",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)", zIndex: 20,
            minWidth: "150px", display: "flex", flexDirection: "column", gap: "2px",
          }}>
            {[15, 30, 45].map((min) => (
              <button
                key={min}
                onClick={() => { onSet(min); setOpen(false); }}
                style={{
                  padding: "8px 14px", borderRadius: 8, border: "none",
                  background: "transparent", color: "var(--text-2, rgba(255,255,255,0.7))",
                  fontSize: "0.82rem", fontWeight: 600, cursor: "pointer",
                  textAlign: "left", transition: "background 0.1s", fontFamily: "inherit",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                {min} minutos
              </button>
            ))}
            <button
              onClick={() => { onSet("end"); setOpen(false); }}
              style={{
                padding: "8px 14px", borderRadius: 8, border: "none",
                background: "transparent", color: "var(--text-2, rgba(255,255,255,0.7))",
                fontSize: "0.82rem", fontWeight: 600, cursor: "pointer",
                textAlign: "left", transition: "background 0.1s", fontFamily: "inherit",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              Fim desta faixa
            </button>
            {active && (
              <>
                <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "2px 0" }} />
                <button
                  onClick={() => { onCancel(); setOpen(false); }}
                  style={{
                    padding: "8px 14px", borderRadius: 8, border: "none",
                    background: "transparent", color: "rgba(239,68,68,0.85)",
                    fontSize: "0.82rem", fontWeight: 600, cursor: "pointer",
                    textAlign: "left", transition: "background 0.1s", fontFamily: "inherit",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  Cancelar timer
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── MiniQueue ────────────────────────────────────────────────────────────────

function MiniQueue({
  queue, currentIndex, accent,
}: {
  queue: import("@/providers/AudioProvider").AudioPublication[];
  currentIndex: number;
  accent: string;
}) {
  const next = queue.slice(currentIndex + 1, currentIndex + 4);
  if (next.length === 0) {
    return (
      <p style={{ fontSize: "0.78rem", color: "var(--text-3, rgba(255,255,255,0.4))", margin: 0, textAlign: "center", padding: "1rem 0" }}>
        Não há próximos na fila
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
      {next.map((item, i) => (
        <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <span style={{
            fontSize: "0.65rem", fontWeight: 700,
            color: "var(--text-3, rgba(255,255,255,0.3))",
            fontVariantNumeric: "tabular-nums", minWidth: "16px",
          }}>
            {i + 1}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontSize: "0.82rem", fontWeight: 600,
              color: "var(--text-2, rgba(255,255,255,0.7))",
              margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {item.titulo}
            </p>
            <p style={{
              fontSize: "0.72rem", color: "var(--text-3, rgba(255,255,255,0.4))",
              margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {item.autorNome}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── HistoryPanel ─────────────────────────────────────────────────────────────

function HistoryPanel({
  history, onPlay, onClear,
}: {
  history: HistoryItem[];
  onPlay: (item: HistoryItem) => void;
  onClear: () => void;
}) {
  if (history.length === 0) {
    return (
      <p style={{ fontSize: "0.78rem", color: "var(--text-3, rgba(255,255,255,0.4))", margin: 0, textAlign: "center", padding: "1rem 0" }}>
        Nenhum áudio ouvido ainda
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
        <span style={{
          fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em",
          textTransform: "uppercase", color: "var(--text-3, rgba(255,255,255,0.4))",
        }}>
          Histórico
        </span>
        <button
          onClick={onClear}
          style={{
            background: "none", border: "none",
            color: "var(--text-3, rgba(255,255,255,0.4))",
            fontSize: "0.72rem", cursor: "pointer",
            padding: "2px 6px", fontFamily: "inherit",
          }}
        >
          Limpar
        </button>
      </div>
      {history.slice(0, 10).map((item) => (
        <button
          key={`${item.id}-${item.playedAt}`}
          onClick={() => onPlay(item)}
          style={{
            display: "flex", alignItems: "center", gap: "0.75rem",
            padding: "8px 6px", borderRadius: 8, border: "none",
            background: "transparent", cursor: "pointer",
            textAlign: "left", transition: "background 0.1s", width: "100%",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontSize: "0.82rem", fontWeight: 600,
              color: "var(--text-2, rgba(255,255,255,0.7))",
              margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {item.titulo}
            </p>
            <p style={{
              fontSize: "0.72rem", color: "var(--text-3, rgba(255,255,255,0.4))",
              margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {item.autorNome}
            </p>
          </div>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"
            style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0 }} aria-hidden="true">
            <path d="M8 5.14v14l11-7-11-7z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

// ─── Tab type ─────────────────────────────────────────────────────────────────

type ExpandedTab = "player" | "queue" | "history";

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
    queue,
    currentIndex,
    toggle,
    seek,
    setVolume,
    playNext,
    playPrevious,
    playbackSpeed,
    setPlaybackSpeed,
    sleepTimer,
    sleepTimerRemaining,
    startSleepTimer,
    setSleepAtEndOfTrack,
    cancelSleepTimer,
    history,
    clearHistory,
    playFromHistory,
  } = useAudioPlayer();

  const [activeTab, setActiveTab] = useState<ExpandedTab>("player");

  const handleVolumeToggle = useCallback(() => {
    setVolume(volume > 0 ? 0 : 1);
  }, [volume, setVolume]);

  const handleSleepSet = useCallback((val: number | "end") => {
    if (val === "end") setSleepAtEndOfTrack();
    else startSleepTimer(val);
  }, [startSleepTimer, setSleepAtEndOfTrack]);

  if (!current) return null;

  const badge = typeBadge(current.tipo);
  const accent = accentColor(current.tipo);
  const muted = volume === 0;

  const tabBtn = (tab: ExpandedTab, icon: React.ReactNode, label: string) => (
    <button
      onClick={() => setActiveTab(tab)}
      aria-label={label}
      aria-pressed={activeTab === tab}
      style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px",
        padding: "8px 4px", border: "none", background: "transparent",
        color: activeTab === tab ? accent : "var(--text-3, rgba(255,255,255,0.4))",
        cursor: "pointer", fontSize: "0.62rem", fontWeight: 700,
        letterSpacing: "0.06em", textTransform: "uppercase",
        borderBottom: `2px solid ${activeTab === tab ? accent : "transparent"}`,
        transition: "color 0.15s, border-color 0.15s", fontFamily: "inherit",
      }}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <>
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 950,
          background: "var(--bg-card, #0f1a12)",
          transform: open ? "translateY(0)" : "translateY(100%)",
          transition: "transform 320ms cubic-bezier(0.32, 0.72, 0, 1)",
          willChange: "transform",
          display: "flex", flexDirection: "column",
          height: "100dvh", overflow: "hidden",
        }}
        aria-hidden={!open}
      >
        {/* Gradient backdrop */}
        <div style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(ellipse at 50% 0%, ${accent}18 0%, transparent 60%)`,
          pointerEvents: "none",
        }} />

        {/* Accent line top */}
        <div style={{
          height: 3, flexShrink: 0, zIndex: 2, position: "relative",
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
        }} />

        {/* ── Header ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0.6rem 1.25rem 0", flexShrink: 0, position: "relative", zIndex: 1,
        }}>
          <button
            onClick={onMinimize}
            aria-label="Minimizar player"
            style={{
              background: "none", border: "none",
              color: "var(--text-2, rgba(255,255,255,0.7))",
              cursor: "pointer", display: "flex", alignItems: "center",
              padding: "8px", borderRadius: "50%", transition: "background 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
          >
            <IconChevronDown size={24} />
          </button>

          <span style={{
            fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em",
            textTransform: "uppercase", color: "var(--text-3, rgba(255,255,255,0.4))",
          }}>
            Tocando agora
          </span>

          {/* Volume toggle */}
          <button
            onClick={handleVolumeToggle}
            aria-label={muted ? "Ativar volume" : "Silenciar"}
            style={{
              background: "none", border: "none",
              color: muted ? "var(--text-3, rgba(255,255,255,0.4))" : "var(--text-2, rgba(255,255,255,0.7))",
              cursor: "pointer", display: "flex", alignItems: "center",
              padding: "8px", transition: "color 0.15s",
            }}
          >
            {muted ? <IconVolumeMute size={20} /> : <IconVolumeOn size={20} />}
          </button>
        </div>

        {/* ── Tab bar ── */}
        <div style={{
          display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0, position: "relative", zIndex: 1, marginTop: "0.25rem",
        }}>
          {tabBtn("player", <IconPlayerPlay size={14} />, "Player")}
          {tabBtn("queue",  <IconQueue size={14} />,  "Fila")}
          {tabBtn("history", <IconHistory size={14} />, "Hist.")}
        </div>

        {/* ── Content area ── */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          padding: "0.75rem 1.5rem 1.5rem", gap: "0.85rem",
          position: "relative", zIndex: 1, minHeight: 0,
          overflowY: activeTab === "player" ? "hidden" : "auto",
          justifyContent: activeTab === "player" ? "space-between" : "flex-start",
        }}>

          {/* ── TAB: PLAYER ── */}
          {activeTab === "player" && (
            <>
              {/* Cover art */}
              <div style={{
                flex: "1 1 0", minHeight: 0, maxHeight: "38vh",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <div style={{
                  width: "min(100%, 38vh)", aspectRatio: "1",
                  borderRadius: "var(--radius-lg, 12px)", overflow: "hidden",
                  boxShadow: `0 16px 48px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.05)`,
                  transition: "transform 0.3s ease",
                  transform: isPlaying ? "scale(1.0)" : "scale(0.92)",
                }}>
                  <AvatarLarge src={current.autorFoto} name={current.autorNome} size={200} />
                </div>
              </div>

              {/* Badge + título + autor */}
              <div style={{ flexShrink: 0 }}>
                <span style={{
                  display: "inline-block", fontSize: "0.6rem", fontWeight: 700,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  color: badge.color, background: badge.bg,
                  padding: "2px 8px", borderRadius: 99, marginBottom: "0.3rem",
                }}>
                  {badge.label}
                </span>
                <p style={{
                  fontSize: "1rem", fontWeight: 800, color: "var(--text-1, #f0fdf4)",
                  lineHeight: 1.3, margin: 0, marginBottom: "0.2rem",
                  display: "-webkit-box", WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical", overflow: "hidden",
                }}>
                  {current.titulo}
                </p>
                <p style={{
                  fontSize: "0.82rem", color: "var(--text-3, rgba(255,255,255,0.4))",
                  margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {current.autorNome}
                </p>
              </div>

              {/* Progress bar */}
              <div style={{ flexShrink: 0 }}>
                <ProgressBar currentTime={currentTime} duration={duration} onSeek={seek} accent={accent} />
              </div>

              {/* Controles de playback */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: "1.5rem", flexShrink: 0,
              }}>
                <button
                  onClick={playPrevious} disabled={!hasPrevious} aria-label="Anterior"
                  style={{
                    background: "none", border: "none",
                    color: hasPrevious ? "var(--text-2, rgba(255,255,255,0.7))" : "rgba(255,255,255,0.15)",
                    cursor: hasPrevious ? "pointer" : "default",
                    display: "flex", alignItems: "center", padding: "8px",
                    transition: "transform 0.15s, color 0.15s",
                  }}
                  onMouseEnter={(e) => { if (hasPrevious) e.currentTarget.style.transform = "scale(1.12)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                >
                  <IconSkipPrev size={26} />
                </button>

                <button
                  onClick={toggle} disabled={isLoading} aria-label={isPlaying ? "Pausar" : "Reproduzir"}
                  style={{
                    width: 64, height: 64, borderRadius: "50%", border: "none",
                    background: accent, color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: isLoading ? "default" : "pointer",
                    opacity: isLoading ? 0.7 : 1,
                    boxShadow: `0 4px 20px ${accent}55`,
                    transition: "transform 0.15s, opacity 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={(e) => { if (!isLoading) { e.currentTarget.style.transform = "scale(1.06)"; e.currentTarget.style.boxShadow = `0 6px 28px ${accent}77`; } }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = `0 4px 20px ${accent}55`; }}
                >
                  {isLoading ? (
                    <span style={{
                      width: 22, height: 22,
                      border: "2.5px solid rgba(255,255,255,0.3)", borderTopColor: "#fff",
                      borderRadius: "50%", display: "inline-block",
                      animation: "exp-spin 0.7s linear infinite",
                    }} />
                  ) : isPlaying ? <IconPause size={28} /> : <IconPlay size={28} />}
                </button>

                <button
                  onClick={playNext} disabled={!hasNext} aria-label="Próximo"
                  style={{
                    background: "none", border: "none",
                    color: hasNext ? "var(--text-2, rgba(255,255,255,0.7))" : "rgba(255,255,255,0.15)",
                    cursor: hasNext ? "pointer" : "default",
                    display: "flex", alignItems: "center", padding: "8px",
                    transition: "transform 0.15s, color 0.15s",
                  }}
                  onMouseEnter={(e) => { if (hasNext) e.currentTarget.style.transform = "scale(1.12)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                >
                  <IconSkipNext size={26} />
                </button>
              </div>

              {/* Velocidade + Sleep timer */}
              <div style={{
                display: "flex", alignItems: "center",
                justifyContent: "space-between", gap: "0.5rem",
                flexShrink: 0,
              }}>
                <SpeedControl speed={playbackSpeed} onChange={setPlaybackSpeed} />
                <SleepTimerControl
                  sleepTimer={sleepTimer}
                  sleepTimerRemaining={sleepTimerRemaining}
                  onSet={handleSleepSet}
                  onCancel={cancelSleepTimer}
                />
              </div>
            </>
          )}

          {/* ── TAB: FILA ── */}
          {activeTab === "queue" && (
            <>
              <h2 style={{
                fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em",
                textTransform: "uppercase", color: "var(--text-3, rgba(255,255,255,0.4))",
                margin: 0,
              }}>
                A seguir na fila
              </h2>
              <MiniQueue queue={queue} currentIndex={currentIndex} accent={accent} />
            </>
          )}

          {/* ── TAB: HISTÓRICO ── */}
          {activeTab === "history" && (
            <HistoryPanel
              history={history}
              onPlay={(item) => { playFromHistory(item); setActiveTab("player"); }}
              onClear={clearHistory}
            />
          )}
        </div>
      </div>

      <style>{`
        @keyframes exp-spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}