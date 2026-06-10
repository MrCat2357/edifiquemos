"use client";

import { useAudioContext } from "@/providers/AudioProvider";
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PlaybackSpeed, HistoryItem } from "@/providers/AudioProvider";

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
  if (seconds >= 60) {
    const m = Math.ceil(seconds / 60);
    return `${m}min`;
  }
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

function AvatarSquare({ src, name, size = 220 }: { src?: string | null; name: string; size?: number }) {
  if (src) return <img src={src} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />;
  return (
    <div style={{
      width: "100%", height: "100%",
      background: "linear-gradient(135deg, var(--emerald-dark, #064e3b), var(--emerald, #10b981))",
      color: "#fff", fontSize: Math.round(size * 0.26) + "px", fontWeight: 700,
      display: "flex", alignItems: "center", justifyContent: "center",
      userSelect: "none", letterSpacing: "0.02em",
    }}>
      {getInitials(name)}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconPlay({ size = 22 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.14v14l11-7-11-7z" /></svg>;
}
function IconPause({ size = 22 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>;
}
function IconSkipPrev({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" /></svg>;
}
function IconSkipNext({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 18l8.5-6L6 6v12zM16 6h2v12h-2z" /></svg>;
}
function IconClose({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" /></svg>;
}
function IconVolumeMute({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></svg>;
}
function IconVolumeOn({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>;
}
function IconMoon({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>;
}
function IconHistory({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/><polyline points="12 7 12 12 15 15"/></svg>;
}
function IconQueue({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>;
}

// ─── PreloadIndicator ─────────────────────────────────────────────────────────

function PreloadIndicator() {
  return (
    <div aria-live="polite" aria-label="Preparando próximo" style={{
      display: "flex", alignItems: "center", gap: "0.4rem",
      padding: "0.25rem 0.6rem", background: "rgba(255,255,255,0.05)",
      borderRadius: 99, alignSelf: "flex-start",
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%",
        background: "rgba(255,255,255,0.35)", display: "inline-block",
        animation: "preload-pulse 1.4s ease-in-out infinite", flexShrink: 0,
      }} />
      <span style={{ fontSize: "0.62rem", fontWeight: 500, letterSpacing: "0.04em", color: "var(--text-3, rgba(255,255,255,0.4))", whiteSpace: "nowrap" }}>
        Preparando próximo...
      </span>
    </div>
  );
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
      <div ref={barRef} onClick={handleClick} role="slider"
        aria-valuenow={Math.round(currentTime)} aria-valuemin={0} aria-valuemax={Math.round(duration)}
        style={{ width: "100%", height: 3, background: "rgba(255,255,255,0.1)", borderRadius: 99, cursor: duration ? "pointer" : "default", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${percent}%`, background: accent, borderRadius: 99, transition: "width 0.25s linear" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.4rem", fontSize: "0.67rem", color: "var(--text-3, rgba(255,255,255,0.4))", fontVariantNumeric: "tabular-nums" }}>
        <span>{formatTime(currentTime)}</span>
        {remaining !== null && (
          <span style={{ color: "rgba(255,255,255,0.25)" }}>{formatRemaining(remaining)}</span>
        )}
        {duration > 0 && <span>{formatTime(duration)}</span>}
      </div>
    </div>
  );
}

// ─── VolumeSlider ─────────────────────────────────────────────────────────────

function VolumeSlider({ volume, onToggle, onChange, accent }: {
  volume: number; onToggle: () => void; onChange: (v: number) => void; accent: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%" }}>
      <button onClick={onToggle} aria-label={volume === 0 ? "Ativar volume" : "Silenciar"}
        style={{ background: "none", border: "none", color: volume === 0 ? "var(--text-3, rgba(255,255,255,0.4))" : "var(--text-2, rgba(255,255,255,0.7))", cursor: "pointer", display: "flex", alignItems: "center", padding: "2px", flexShrink: 0, transition: "color 0.15s" }}>
        {volume === 0 ? <IconVolumeMute size={16} /> : <IconVolumeOn size={16} />}
      </button>
      <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => onChange(parseFloat(e.target.value))} aria-label="Volume"
        style={{ flex: 1, height: 3, appearance: "none", WebkitAppearance: "none", background: `linear-gradient(to right, ${accent} ${volume * 100}%, rgba(255,255,255,0.1) ${volume * 100}%)`, borderRadius: 99, cursor: "pointer", outline: "none" }} />
    </div>
  );
}

// ─── SpeedControl ─────────────────────────────────────────────────────────────

function SpeedControl({ speed, onChange }: { speed: PlaybackSpeed; onChange: (s: PlaybackSpeed) => void }) {
  const speeds: PlaybackSpeed[] = [1, 1.5, 2];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
      <span style={{ fontSize: "0.62rem", fontWeight: 600, color: "var(--text-3, rgba(255,255,255,0.4))", letterSpacing: "0.06em", textTransform: "uppercase", marginRight: "0.1rem" }}>
        Vel.
      </span>
      {speeds.map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          aria-label={`Velocidade ${s}x`}
          aria-pressed={speed === s}
          style={{
            padding: "3px 8px", borderRadius: 99, border: "1px solid",
            borderColor: speed === s ? "currentColor" : "rgba(255,255,255,0.1)",
            background: speed === s ? "rgba(255,255,255,0.1)" : "transparent",
            color: speed === s ? "var(--text-1, #f0fdf4)" : "var(--text-3, rgba(255,255,255,0.4))",
            fontSize: "0.68rem", fontWeight: 700, cursor: "pointer",
            transition: "all 0.15s", fontFamily: "inherit",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {s}×
        </button>
      ))}
    </div>
  );
}

// ─── SleepTimerControl ────────────────────────────────────────────────────────

function SleepTimerControl({
  sleepTimer, sleepTimerRemaining, onSet, onCancel,
}: {
  sleepTimer: import("@/providers/AudioProvider").SleepTimerMode;
  sleepTimerRemaining: number | null;
  onSet: (minutes: number | "end") => void;
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
        title="Sleep timer"
        style={{
          display: "flex", alignItems: "center", gap: "4px",
          padding: "3px 8px", borderRadius: 99, border: "1px solid",
          borderColor: active ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.1)",
          background: active ? "rgba(255,255,255,0.08)" : "transparent",
          color: active ? "var(--text-1, #f0fdf4)" : "var(--text-3, rgba(255,255,255,0.4))",
          fontSize: "0.68rem", fontWeight: 600, cursor: "pointer",
          transition: "all 0.15s", fontFamily: "inherit",
        }}
      >
        <IconMoon size={12} />
        {label ?? "Timer"}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10 }} />
          <div style={{
            position: "absolute", bottom: "calc(100% + 6px)", right: 0,
            background: "var(--bg-elevated, #111a13)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "var(--radius-lg, 12px)", padding: "0.5rem",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)", zIndex: 20,
            minWidth: "140px", display: "flex", flexDirection: "column", gap: "2px",
          }}>
            {[15, 30, 45].map((min) => (
              <button key={min} onClick={() => { onSet(min); setOpen(false); }}
                style={{ padding: "6px 12px", borderRadius: "var(--radius-full, 99px)", border: "none", background: "transparent", color: "var(--text-2, rgba(255,255,255,0.7))", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", textAlign: "left", transition: "background 0.1s", fontFamily: "inherit" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                {min} minutos
              </button>
            ))}
            <button onClick={() => { onSet("end"); setOpen(false); }}
              style={{ padding: "6px 12px", borderRadius: "var(--radius-full, 99px)", border: "none", background: "transparent", color: "var(--text-2, rgba(255,255,255,0.7))", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", textAlign: "left", transition: "background 0.1s", fontFamily: "inherit" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
              Fim desta faixa
            </button>
            {active && (
              <>
                <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "2px 0" }} />
                <button onClick={() => { onCancel(); setOpen(false); }}
                  style={{ padding: "6px 12px", borderRadius: "var(--radius-full, 99px)", border: "none", background: "transparent", color: "rgba(239,68,68,0.8)", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", textAlign: "left", transition: "background 0.1s", fontFamily: "inherit" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
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

function MiniQueue({ queue, currentIndex, accent }: {
  queue: import("@/providers/AudioProvider").AudioPublication[];
  currentIndex: number;
  accent: string;
}) {
  const next = queue.slice(currentIndex + 1, currentIndex + 4);
  if (next.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <span style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-3, rgba(255,255,255,0.4))", marginBottom: "0.1rem" }}>
        A seguir
      </span>
      {next.map((item, i) => (
        <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "4px 0" }}>
          <span style={{ fontSize: "0.6rem", color: "var(--text-3, rgba(255,255,255,0.3))", fontVariantNumeric: "tabular-nums", minWidth: "12px" }}>
            {i + 1}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-2, rgba(255,255,255,0.6))", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.titulo}
            </p>
            <p style={{ fontSize: "0.62rem", color: "var(--text-3, rgba(255,255,255,0.35))", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.autorNome}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── HistoryPanel ─────────────────────────────────────────────────────────────

function HistoryPanel({ history, onPlay, onClear }: {
  history: HistoryItem[];
  onPlay: (item: HistoryItem) => void;
  onClear: () => void;
}) {
  if (history.length === 0) {
    return (
      <div style={{ padding: "0.75rem 0", textAlign: "center" }}>
        <p style={{ fontSize: "0.75rem", color: "var(--text-3, rgba(255,255,255,0.4))", margin: 0 }}>
          Nenhum áudio ouvido ainda
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
        <span style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-3, rgba(255,255,255,0.4))" }}>
          Histórico
        </span>
        <button onClick={onClear}
          style={{ background: "none", border: "none", color: "var(--text-3, rgba(255,255,255,0.4))", fontSize: "0.62rem", cursor: "pointer", padding: "2px 4px", fontFamily: "inherit" }}>
          Limpar
        </button>
      </div>
      {history.slice(0, 10).map((item) => (
        <button key={`${item.id}-${item.playedAt}`} onClick={() => onPlay(item)}
          style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "5px 4px", borderRadius: "var(--radius-full, 8px)", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", transition: "background 0.1s", width: "100%" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-2, rgba(255,255,255,0.65))", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.titulo}
            </p>
            <p style={{ fontSize: "0.62rem", color: "var(--text-3, rgba(255,255,255,0.35))", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.autorNome}
            </p>
          </div>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0 }} aria-hidden="true">
            <path d="M8 5.14v14l11-7-11-7z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

// ─── Tab type ────────────────────────────────────────────────────────────────

type SidebarTab = "player" | "queue" | "history";

// ─── NowPlayingSidebar ────────────────────────────────────────────────────────

export const SIDEBAR_WIDTH = 280;

export default function NowPlayingSidebar() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SidebarTab>("player");

  const {
    current, isPlaying, isLoading, currentTime, duration,
    volume, queue, currentIndex, toggle, seek, setVolume, close,
    playNext, playPrevious, preloadStatus,
    // Fase 11
    playbackSpeed, setPlaybackSpeed,
    sleepTimer, sleepTimerRemaining, setSleepTimer,
    history, clearHistory, playFromHistory,
  } = useAudioContext();

  const hasNext     = currentIndex >= 0 && currentIndex < queue.length - 1;
  const hasPrevious = currentIndex > 0;

  const handleVolumeToggle = useCallback(() => {
    setVolume(volume > 0 ? 0 : 1);
  }, [volume, setVolume]);

  const handleSleepSet = useCallback((val: number | "end") => {
    if (val === "end") {
      setSleepTimer({ type: "end_of_track" });
    } else {
      setSleepTimer({ type: "duration", minutes: val, endsAt: Date.now() + val * 60 * 1000 });
    }
  }, [setSleepTimer]);

  const handleSleepCancel = useCallback(() => {
    setSleepTimer({ type: "off" });
  }, [setSleepTimer]);

  const visible = !!current;
  const badge   = current ? typeBadge(current.tipo) : null;
  const accent  = current ? accentColor(current.tipo) : "var(--emerald, #10b981)";
  const timeRemaining = duration > 0 ? Math.max(0, duration - currentTime) : null;

  const tabBtn = (tab: SidebarTab, icon: React.ReactNode, label: string) => (
    <button
      onClick={() => setActiveTab(tab)}
      aria-label={label}
      aria-pressed={activeTab === tab}
      style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
        padding: "6px 4px", border: "none", background: "transparent",
        color: activeTab === tab ? accent : "var(--text-3, rgba(255,255,255,0.4))",
        cursor: "pointer", fontSize: "0.58rem", fontWeight: 700,
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
      <aside
        aria-label="Tocando agora"
        style={{
          position: "fixed", top: "var(--header-h, 64px)", right: 0, bottom: 0,
          width: SIDEBAR_WIDTH, background: "var(--bg-card, #0f1a12)",
          borderLeft: "1px solid var(--border-light, rgba(255,255,255,0.08))",
          display: "flex", flexDirection: "column",
          transform: visible ? "translateX(0)" : "translateX(100%)",
          opacity: visible ? 1 : 0,
          transition: "transform 250ms cubic-bezier(0.32, 0.72, 0, 1), opacity 250ms ease",
          willChange: "transform", zIndex: 80,
        }}
      >
        {current && (
          <>
            {/* Accent line */}
            <div style={{ position: "sticky", top: 0, height: 3, background: `linear-gradient(90deg, transparent, ${accent}, transparent)`, flexShrink: 0, zIndex: 2 }} />

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1.25rem 0.5rem", flexShrink: 0 }}>
              <span style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-3, rgba(255,255,255,0.4))" }}>
                Tocando agora
              </span>
              <button onClick={close} aria-label="Fechar player"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-2, rgba(255,255,255,0.7))", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: "50%", flexShrink: 0, transition: "background 0.15s, color 0.15s", position: "relative", zIndex: 10 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.14)"; e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "var(--text-2, rgba(255,255,255,0.7))"; }}>
                <IconClose size={14} />
              </button>
            </div>

            {/* Tab bar */}
            <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
              {tabBtn("player", <IconPlay size={12} />, "Player")}
              {tabBtn("queue",  <IconQueue size={12} />, "Fila")}
              {tabBtn("history", <IconHistory size={12} />, "Hist.")}
            </div>

            {/* Content area — scrollable */}
            <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.25rem 2rem", display: "flex", flexDirection: "column", gap: "1rem" }}>

              {/* ── TAB: PLAYER ────────────────────────────────────────── */}
              {activeTab === "player" && (
                <>
                  {/* Cover art */}
                  <div style={{
                    width: "100%", aspectRatio: "1", borderRadius: "var(--radius-lg, 12px)",
                    overflow: "hidden", boxShadow: `0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)`,
                    flexShrink: 0, transition: "transform 0.4s ease",
                    transform: isPlaying ? "scale(1)" : "scale(0.94)",
                  }}>
                    <AvatarSquare src={current.autorFoto} name={current.autorNome} size={SIDEBAR_WIDTH - 40} />
                  </div>

                  {/* Badge + título + autor */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                    {badge && (
                      <span style={{ display: "inline-block", alignSelf: "flex-start", fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: badge.color, background: badge.bg, padding: "2px 8px", borderRadius: 99 }}>
                        {badge.label}
                      </span>
                    )}
                    <p style={{ fontSize: "0.9rem", fontWeight: 800, color: "var(--text-1, #f0fdf4)", lineHeight: 1.35, margin: 0, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {current.titulo}
                    </p>
                    <button
                      onClick={() => { if (current.autorSlug) router.push(`/perfil/${current.autorSlug}`); }}
                      style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: current.autorSlug ? "pointer" : "default", color: current.autorSlug ? accent : "var(--text-3, rgba(255,255,255,0.4))", fontSize: "0.78rem", fontWeight: 500, transition: "opacity 0.15s", fontFamily: "inherit", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      onMouseEnter={(e) => { if (current.autorSlug) e.currentTarget.style.opacity = "0.7"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}>
                      {current.autorNome}
                    </button>
                  </div>

                  {/* Progress + tempo restante */}
                  <ProgressBar currentTime={currentTime} duration={duration} onSeek={seek} accent={accent} />

                  {/* Controls */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem" }}>
                    <button onClick={playPrevious} disabled={!hasPrevious} aria-label="Anterior"
                      style={{ background: "none", border: "none", color: hasPrevious ? "var(--text-2, rgba(255,255,255,0.7))" : "rgba(255,255,255,0.15)", cursor: hasPrevious ? "pointer" : "default", display: "flex", alignItems: "center", padding: "6px", transition: "transform 0.15s, color 0.15s" }}
                      onMouseEnter={(e) => { if (hasPrevious) e.currentTarget.style.transform = "scale(1.12)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}>
                      <IconSkipPrev size={20} />
                    </button>

                    <button onClick={toggle} disabled={isLoading} aria-label={isPlaying ? "Pausar" : "Reproduzir"}
                      style={{ width: 52, height: 52, borderRadius: "50%", border: "none", background: accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: isLoading ? "default" : "pointer", opacity: isLoading ? 0.6 : 1, boxShadow: `0 3px 16px ${accent}55`, transition: "transform 0.15s, opacity 0.15s" }}
                      onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.transform = "scale(1.08)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}>
                      {isLoading ? (
                        <span style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "sidebar-spin 0.7s linear infinite" }} />
                      ) : isPlaying ? <IconPause size={22} /> : <IconPlay size={22} />}
                    </button>

                    <button onClick={playNext} disabled={!hasNext} aria-label="Próximo"
                      style={{ background: "none", border: "none", color: hasNext ? "var(--text-2, rgba(255,255,255,0.7))" : "rgba(255,255,255,0.15)", cursor: hasNext ? "pointer" : "default", display: "flex", alignItems: "center", padding: "6px", transition: "transform 0.15s, color 0.15s" }}
                      onMouseEnter={(e) => { if (hasNext) e.currentTarget.style.transform = "scale(1.12)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}>
                      <IconSkipNext size={20} />
                    </button>
                  </div>

                  {/* Volume */}
                  <VolumeSlider volume={volume} onToggle={handleVolumeToggle} onChange={setVolume} accent={accent} />

                  {/* Fase 11 — controles extras: velocidade + sleep timer */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                    <SpeedControl speed={playbackSpeed} onChange={setPlaybackSpeed} />
                    <SleepTimerControl
                      sleepTimer={sleepTimer}
                      sleepTimerRemaining={sleepTimerRemaining}
                      onSet={handleSleepSet}
                      onCancel={handleSleepCancel}
                    />
                  </div>

                  {/* Preload indicator */}
                  {preloadStatus === "loading" && hasNext && <PreloadIndicator />}
                </>
              )}

              {/* ── TAB: FILA ──────────────────────────────────────────── */}
              {activeTab === "queue" && (
                <MiniQueue queue={queue} currentIndex={currentIndex} accent={accent} />
              )}

              {/* ── TAB: HISTÓRICO ─────────────────────────────────────── */}
              {activeTab === "history" && (
                <HistoryPanel
                  history={history}
                  onPlay={playFromHistory}
                  onClear={clearHistory}
                />
              )}
            </div>
          </>
        )}
      </aside>

      <style>{`
        @keyframes sidebar-spin { to { transform: rotate(360deg); } }
        @keyframes preload-pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.85); }
          50%       { opacity: 1;   transform: scale(1.15); }
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none; width: 12px; height: 12px;
          border-radius: 50%; background: #fff; cursor: pointer;
          box-shadow: 0 1px 4px rgba(0,0,0,0.4); transition: transform 0.15s;
        }
        input[type=range]::-webkit-slider-thumb:hover { transform: scale(1.25); }
        input[type=range]::-moz-range-thumb {
          width: 12px; height: 12px; border-radius: 50%;
          background: #fff; cursor: pointer; border: none;
          box-shadow: 0 1px 4px rgba(0,0,0,0.4);
        }
      `}</style>
    </>
  );
}