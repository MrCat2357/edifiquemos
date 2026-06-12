/**
 * components/audio/AudioGeneratingFeedback.tsx
 *
 * Exibido no lugar do botão "Ouvir" (ou dentro do MiniPlayer) quando
 * audioStatus === "generating".
 *
 * Props:
 *   postId   — ID do post no Firestore (para escutar mudanças em tempo real)
 *   onReady  — chamado quando audioStatus virar "ready"; recebe a audioUrl
 *   onError  — chamado quando audioStatus virar "error"
 *
 * Comportamento:
 *   - Escuta o documento do Firestore em tempo real via onSnapshot.
 *     Assim que o áudio ficar pronto, onReady é chamado automaticamente.
 *   - Exibe contador regressivo de 10 s entre re-checks visuais.
 *   - Botão "Tentar novamente" reseta o contador e aguarda mais 10 s.
 *   - Para automaticamente após MAX_AUTO_RETRIES (≈ 3 min) sem resposta.
 *   - Não depende de nenhuma lib externa além do Firebase SDK já no projeto.
 */

import { useEffect, useRef, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

// ── Constantes ───────────────────────────────────────────────────────────────

const RETRY_INTERVAL_S  = 10;
const MAX_AUTO_RETRIES  = 18; // 18 × 10 s = 3 min

// ── Componente ───────────────────────────────────────────────────────────────

interface Props {
  postId:   string;
  onReady?: (audioUrl: string) => void;
  onError?: () => void;
}

export default function AudioGeneratingFeedback({ postId, onReady, onError }: Props) {
  const [retries,       setRetries]       = useState(0);
  const [manualPending, setManualPending] = useState(false);
  const [countdown,     setCountdown]     = useState(RETRY_INTERVAL_S);

  const timerRef     = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Escuta Firestore em tempo real ────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "posts", postId), (snap) => {
      if (!snap.exists()) return;
      const status: string = snap.data()?.audioStatus ?? "";
      const url:    string = snap.data()?.audioUrl    ?? "";

      if (status === "ready" && url) {
        onReady?.(url);
      } else if (status === "error") {
        onError?.();
      }
    });
    return () => unsub();
  }, [postId, onReady, onError]);

  // ── Contador regressivo visual (reinicia a cada retry) ───────────────────
  useEffect(() => {
    if (retries >= MAX_AUTO_RETRIES) return;

    // Limpa ciclo anterior
    if (timerRef.current)     clearTimeout(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    setCountdown(RETRY_INTERVAL_S);

    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1_000);

    // Após o intervalo, incrementa retry (o onSnapshot já cuida da transição
    // real; o retry apenas reseta o visual para o usuário saber que o sistema
    // ainda está verificando).
    timerRef.current = setTimeout(() => {
      setRetries((r) => r + 1);
    }, RETRY_INTERVAL_S * 1_000);

    return () => {
      if (timerRef.current)     clearTimeout(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retries]);

  // ── Botão manual ──────────────────────────────────────────────────────────
  function handleTentarNovamente() {
    if (manualPending) return;
    if (timerRef.current)     clearTimeout(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    setManualPending(true);
    setCountdown(RETRY_INTERVAL_S);

    setTimeout(() => {
      setManualPending(false);
      setRetries((r) => r + 1);
    }, RETRY_INTERVAL_S * 1_000);
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  const atingiuLimite = retries >= MAX_AUTO_RETRIES;

  return (
    <div
      style={{
        display:      "flex",
        alignItems:   "center",
        gap:          "0.625rem",
        padding:      "0.625rem 0.875rem",
        borderRadius: "var(--radius-lg)",
        border:       "1px solid var(--border-light)",
        background:   "var(--bg-elevated)",
        fontSize:     "0.8rem",
        color:        "var(--text-2)",
        flexWrap:     "wrap",
      }}
    >
      {/* Spinner */}
      {!atingiuLimite && (
        <span
          style={{
            display:        "inline-block",
            width:          14,
            height:         14,
            border:         "2px solid var(--border-light)",
            borderTopColor: "var(--emerald)",
            borderRadius:   "50%",
            flexShrink:     0,
            animation:      "tts-generating-spin 0.9s linear infinite",
          }}
        />
      )}

      {/* Mensagem */}
      <span style={{ flex: 1, minWidth: "10rem", lineHeight: 1.45 }}>
        {atingiuLimite ? (
          <>
            A geração de áudio está demorando.{" "}
            <strong style={{ color: "var(--text-1)" }}>Recarregue a página</strong> em instantes.
          </>
        ) : manualPending ? (
          <>
            Verificando em{" "}
            <strong style={{ color: "var(--text-1)" }}>{countdown}s</strong>…
          </>
        ) : (
          <>
            Seu áudio está sendo preparado, verificando em{" "}
            <strong style={{ color: "var(--text-1)" }}>{countdown}s</strong>…
          </>
        )}
      </span>

      {/* Botão */}
      {!atingiuLimite && (
        <button
          type="button"
          onClick={handleTentarNovamente}
          disabled={manualPending}
          style={{
            padding:      "3px 12px",
            borderRadius: "var(--radius-full)",
            border:       "1px solid var(--border-light)",
            background:   "transparent",
            color:        manualPending ? "var(--text-3)" : "var(--emerald)",
            fontWeight:   600,
            fontSize:     "0.75rem",
            cursor:       manualPending ? "default" : "pointer",
            transition:   "all 0.15s",
            whiteSpace:   "nowrap",
            flexShrink:   0,
          }}
        >
          {manualPending ? "Aguardando…" : "Tentar novamente"}
        </button>
      )}

      <style>{`
        @keyframes tts-generating-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}