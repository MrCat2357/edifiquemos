"use client";

import { useState, useCallback } from "react";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import MiniPlayer from "./MiniPlayer";
import ExpandedPlayer from "./ExpandedPlayer";
import NowPlayingSidebar from "./NowPlayingSidebar";

/**
 * GlobalAudioPlayer — Fase 5
 *
 * Mobile  (<1024px): MiniPlayer (bottom bar) + ExpandedPlayer (fullscreen)
 * Desktop (≥1024px): NowPlayingSidebar (fixed right panel)
 *
 * Correções 5.2:
 * - Remove botão "▶ Ouvir" flutuante que sobrepunha a sidebar no desktop.
 *   Esse botão é suprimido via CSS quando o player está ativo.
 *   Seletores cobertos:
 *     • .audio-listen-btn        — classe recomendada nos botões dos cards
 *     • [data-audio-listen-btn]  — alternativa via data-attribute
 *   No desktop com player ativo ambos somem via display:none.
 *
 * - NowPlayingSidebar tem zIndex:80 (abaixo do header, acima do conteúdo).
 *   O botão × dentro dela tem zIndex:10 relativo ao aside, sempre clicável.
 */
export default function GlobalAudioPlayer() {
  const { current } = useAudioPlayer();
  const [expanded, setExpanded] = useState(false);

  const handleExpand   = useCallback(() => setExpanded(true),  []);
  const handleMinimize = useCallback(() => setExpanded(false), []);

  return (
    <>
      {/* ── Mobile ──────────────────────────────────────────────────────── */}
      <div className="gap-mobile-player">
        {current && (
          <>
            <div
              style={{
                position: "fixed",
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 900,
                background: "var(--bg-card, #0f1a12)",
                borderTop: "1px solid var(--border-light, rgba(255,255,255,0.08))",
                boxShadow: "0 -6px 24px rgba(0,0,0,0.4)",
              }}
            >
              <MiniPlayer onExpand={handleExpand} />
            </div>
            <ExpandedPlayer open={expanded} onMinimize={handleMinimize} />
          </>
        )}
      </div>

      {/* ── Desktop ─────────────────────────────────────────────────────── */}
      <div className="gap-desktop-sidebar">
        <NowPlayingSidebar />
      </div>

      <style>{`
        /* Variáveis base — sempre presentes */
        :root {
          --header-h: 64px;
          --sidebar-player-w: 0px;
        }

        /* ── Mobile (<1024px) ─────────────────────────────────────────── */
        @media (max-width: 1023px) {
          .gap-desktop-sidebar { display: none !important; }

          ${current ? `
            main { padding-bottom: 72px; }
          ` : ""}
        }

        /* ── Desktop (≥1024px) ────────────────────────────────────────── */
        @media (min-width: 1024px) {
          .gap-mobile-player { display: none !important; }

          ${current ? `
            :root { --sidebar-player-w: 280px; }

            /*
              Empurra o conteúdo principal para não ficar atrás da sidebar.
              Usa transition para suavizar a abertura/fechamento.
            */
            main {
              padding-right: calc(280px + 1rem);
              transition: padding-right 250ms cubic-bezier(0.32, 0.72, 0, 1);
            }

            /*
              Oculta QUALQUER botão "Ouvir" flutuante enquanto a sidebar
              do player estiver aberta, evitando sobreposição com o botão ×.

              Adicione UMA das marcações abaixo nos seus botões "Ouvir":
                • className="audio-listen-btn"
                • data-audio-listen-btn="true"

              O componente AudioListenButton (se existir) já pode usar
              useAudioPlayer().current para se auto-ocultar em vez de
              depender só do CSS — mas este CSS é o fallback garantido.
            */
            .audio-listen-btn,
            [data-audio-listen-btn] {
              display: none !important;
              pointer-events: none !important;
            }
          ` : `
            :root { --sidebar-player-w: 0px; }
            main {
              transition: padding-right 250ms cubic-bezier(0.32, 0.72, 0, 1);
            }
          `}
        }
      `}</style>
    </>
  );
}