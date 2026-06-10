"use client";

/**
 * ResumePrompt — Fase 11
 *
 * Exibe um toast discreto no canto inferior esquerdo (mobile) ou superior
 * direito (desktop) quando detecta um estado de retomada salvo no localStorage.
 *
 * Uso: montar em app/layout.tsx (client component) ou em GlobalAudioPlayer.
 *
 *   import ResumePrompt from "@/components/audio/ResumePrompt";
 *   // dentro do layout, após <AudioProvider>:
 *   <ResumePrompt />
 *
 * O toast aparece apenas uma vez por sessão (é removido do localStorage assim
 * que o usuário aceita ou descarta).
 */

import { useEffect, useState, useCallback } from "react";
import { getResumeState, clearSavedResumeState } from "@/providers/AudioProvider";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import type { AudioPublication, AudioContextType } from "@/providers/AudioProvider";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function accentColor(tipo: string): string {
  if (tipo === "sermao") return "var(--emerald, #10b981)";
  if (tipo === "artigo") return "#60a5fa";
  return "#a78bfa";
}

// ─── ResumePrompt ─────────────────────────────────────────────────────────────

export default function ResumePrompt() {
  const { playQueue, seek, play } = useAudioPlayer();

  type ResumeData = {
    pub: AudioPublication;
    queue: AudioPublication[];
    currentIndex: number;
    contextType: AudioContextType;
    positionSeconds: number;
  };

  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Detectar estado salvo uma única vez ao montar
  useEffect(() => {
    // Pequeno delay para não interferir com a hidratação inicial
    const t = setTimeout(() => {
      const state = getResumeState();
      if (!state) return;
      // Só mostrar se a posição for significativa (> 10s)
      if (state.positionSeconds < 10) {
        clearSavedResumeState();
        return;
      }
      setResumeData(state);
      setVisible(true);
    }, 800);
    return () => clearTimeout(t);
  }, []);

  // Auto-dismiss após 12 segundos sem interação
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => handleDismiss(), 12000);
    return () => clearTimeout(t);
  }, [visible]);

  const handleResume = useCallback(() => {
    if (!resumeData) return;
    const { pub, queue, contextType, positionSeconds } = resumeData;

    if (queue.length > 1) {
      playQueue(pub, queue, contextType);
    } else {
      play(pub);
    }

    // Seek com pequeno delay para o áudio carregar
    setTimeout(() => {
      seek(positionSeconds);
    }, 600);

    clearSavedResumeState();
    setVisible(false);
    setDismissed(true);
  }, [resumeData, playQueue, play, seek]);

  const handleDismiss = useCallback(() => {
    clearSavedResumeState();
    setVisible(false);
    setDismissed(true);
  }, []);

  if (!resumeData || dismissed) return null;

  const accent = accentColor(resumeData.pub.tipo);
  const truncatedTitle = resumeData.pub.titulo.length > 42
    ? resumeData.pub.titulo.slice(0, 42) + "…"
    : resumeData.pub.titulo;

  return (
    <>
      <div
        role="dialog"
        aria-label="Retomar reprodução"
        style={{
          position: "fixed",
          bottom: "calc(72px + 0.75rem)", // acima do mini-player no mobile
          left: "0.75rem",
          right: "0.75rem",
          zIndex: 800,
          // No desktop: canto superior direito, largura fixa
          maxWidth: 340,
          // Animação de entrada
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(12px)",
          transition: "opacity 300ms ease, transform 300ms ease",
          pointerEvents: visible ? "auto" : "none",
        }}
      >
        <div style={{
          background: "var(--bg-card, #0f1a12)",
          border: `1px solid ${accent}40`,
          borderLeft: `3px solid ${accent}`,
          borderRadius: "var(--radius-lg, 12px)",
          padding: "0.75rem 1rem",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          display: "flex", flexDirection: "column", gap: "0.6rem",
        }}>
          {/* Linha de info */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{
              fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em",
              textTransform: "uppercase", color: accent,
            }}>
              Continuar ouvindo
            </span>
            <p style={{
              fontSize: "0.82rem", fontWeight: 700,
              color: "var(--text-1, #f0fdf4)",
              margin: 0, lineHeight: 1.3,
            }}>
              {truncatedTitle}
            </p>
            <p style={{
              fontSize: "0.72rem", color: "var(--text-3, rgba(255,255,255,0.4))",
              margin: 0,
            }}>
              {resumeData.pub.autorNome} · {formatTime(resumeData.positionSeconds)}
            </p>
          </div>

          {/* Botões */}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={handleResume}
              style={{
                flex: 1, padding: "7px 0",
                borderRadius: 99, border: "none",
                background: accent, color: "#fff",
                fontSize: "0.78rem", fontWeight: 700,
                cursor: "pointer", transition: "opacity 0.15s",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.88"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
            >
              Retomar
            </button>
            <button
              onClick={handleDismiss}
              style={{
                padding: "7px 14px",
                borderRadius: 99,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "transparent",
                color: "var(--text-3, rgba(255,255,255,0.4))",
                fontSize: "0.78rem", fontWeight: 600,
                cursor: "pointer", transition: "background 0.15s",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              Dispensar
            </button>
          </div>
        </div>
      </div>

      {/* Desktop override — reposicionar no canto superior direito */}
      <style>{`
        @media (min-width: 1024px) {
          [aria-label="Retomar reprodução"] {
            bottom: auto !important;
            top: calc(var(--header-h, 64px) + 0.75rem);
            left: auto !important;
            right: calc(var(--sidebar-player-w, 280px) + 0.75rem) !important;
          }
        }
      `}</style>
    </>
  );
}