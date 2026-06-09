"use client";

/**
 * components/painel-autor/PainelVozObsoleta.tsx
 *
 * Fase 10 — UI para o autor gerenciar posts com voz desatualizada.
 *
 * Exibe:
 *   - Contador de sermões com voz antiga (audioStatus === "stale")
 *   - Botão "Atualizar todos para minha nova voz"
 *   - Barra de progresso com polling no Firestore
 *
 * Props:
 *   autorId  — UID do autor autenticado
 *   idToken  — Firebase ID Token para autenticar as chamadas de API
 */

import { useEffect, useState, useCallback, useRef } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase"; // ajuste o caminho conforme seu projeto

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface Props {
  autorId: string;
  idToken: string;
}

type Estado =
  | "idle"         // aguardando ação do usuário
  | "invalidando"  // chamando /api/tts/invalidar-autor
  | "regenerando"  // posts stale sendo processados (polling ativo)
  | "concluido"    // todos os posts atualizados
  | "erro";        // falha na invalidação

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const POLLING_INTERVAL_MS = 4_000; // a cada 4s consulta o Firestore
const POLLING_TIMEOUT_MS  = 5 * 60 * 1_000; // para de fazer polling após 5min

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function PainelVozObsoleta({ autorId, idToken }: Props) {
  const [totalStale,    setTotalStale]    = useState<number | null>(null);
  const [totalInicial,  setTotalInicial]  = useState<number>(0);
  const [estado,        setEstado]        = useState<Estado>("idle");
  const [erroMsg,       setErroMsg]       = useState<string | null>(null);

  const pollingRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef    = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const mountedRef    = useRef(true);

  // ── Listener em tempo real para contar posts stale ──────────────────────
  useEffect(() => {
    mountedRef.current = true;

    const q = query(
      collection(db, "posts"),
      where("autorId",     "==", autorId),
      where("audioStatus", "==", "stale")
    );

    // Usamos onSnapshot para atualizar o contador em tempo real durante o polling
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!mountedRef.current) return;
      setTotalStale(snapshot.size);

      // Se chegou a zero enquanto estava regenerando → concluído
      setEstado((prev) => {
        if (prev === "regenerando" && snapshot.size === 0) {
          pararPolling();
          return "concluido";
        }
        return prev;
      });
    });

    return () => {
      mountedRef.current = false;
      unsubscribe();
      pararPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autorId]);

  // ── Helpers de polling ────────────────────────────────────────────────────
  function pararPolling() {
    if (pollingRef.current)  clearInterval(pollingRef.current);
    if (timeoutRef.current)  clearTimeout(timeoutRef.current);
    pollingRef.current = null;
    timeoutRef.current = null;
  }

  const dispararRegeneracaoProativa = useCallback(async () => {
    // Dispara o cron manualmente — requer INTERNAL_API_SECRET no cliente
    // (deixar em branco se preferir depender apenas da regeneração lazy).
    // Em produção, prefira deixar o Vercel Cron chamar automaticamente.
    const secret = process.env.NEXT_PUBLIC_CRON_SECRET;
    if (!secret) return;

    try {
      await fetch("/api/tts/regenerar-pendentes", {
        method:  "GET",
        headers: { "x-cron-secret": secret },
      });
    } catch {
      // Non-fatal: regeneração lazy ainda funcionará quando o usuário clicar "Ouvir"
    }
  }, []);

  function iniciarPolling() {
    // O onSnapshot já mantém o contador atualizado; o polling chama a rota
    // proativa repetidamente até zerar os stale.
    pollingRef.current = setInterval(() => {
      dispararRegeneracaoProativa();
    }, POLLING_INTERVAL_MS);

    // Timeout de segurança para não deixar o polling eterno
    timeoutRef.current = setTimeout(() => {
      pararPolling();
      if (mountedRef.current) {
        setEstado((prev) => (prev === "regenerando" ? "idle" : prev));
      }
    }, POLLING_TIMEOUT_MS);
  }

  // ── Ação principal: invalidar + iniciar regeneração ───────────────────────
  const handleAtualizarTodos = useCallback(async () => {
    if (estado === "invalidando" || estado === "regenerando") return;
    if (!totalStale || totalStale === 0) return;

    setEstado("invalidando");
    setErroMsg(null);
    setTotalInicial(totalStale);

    try {
      const res = await fetch("/api/tts/invalidar-autor", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${idToken}`,
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      // Invalidação concluída — inicia regeneração proativa
      setEstado("regenerando");
      await dispararRegeneracaoProativa(); // primeira chamada imediata
      iniciarPolling();
    } catch (err) {
      console.error("[PainelVoz] Erro ao invalidar:", err);
      setErroMsg(err instanceof Error ? err.message : "Erro desconhecido.");
      setEstado("erro");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, totalStale, idToken, dispararRegeneracaoProativa]);

  // ── Progresso ────────────────────────────────────────────────────────────
  const progresso = (() => {
    if (estado !== "regenerando" || totalInicial === 0 || totalStale === null) return 0;
    const processados = totalInicial - totalStale;
    return Math.min(100, Math.round((processados / totalInicial) * 100));
  })();

  // ── Captura antes do narrowing do JSX ────────────────────────────────────
  const estaCarregando = estado === "invalidando";

  // ── Não renderiza nada se não há posts stale e não está em progresso ─────
  if (totalStale === 0 && estado === "idle") return null;
  if (totalStale === null) return null; // ainda carregando

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
      {/* Cabeçalho */}
      <div className="flex items-start gap-3">
        <span className="text-2xl" role="img" aria-label="alerta">⚠️</span>
        <div>
          <p className="font-semibold text-amber-900 leading-snug">
            {estado === "concluido"
              ? "Todos os sermões foram atualizados!"
              : `${totalStale} ${totalStale === 1 ? "sermão com voz antiga" : "sermões com voz antiga"}`}
          </p>
          {estado === "idle" && (
            <p className="text-sm text-amber-700 mt-0.5">
              Esses sermões foram gerados antes de você configurar sua voz personalizada.
              Clique abaixo para regerar todos com a nova voz.
            </p>
          )}
          {estado === "regenerando" && (
            <p className="text-sm text-amber-700 mt-0.5">
              Atualizando {totalInicial - (totalStale ?? totalInicial)} de {totalInicial} sermões…
              Os áudios serão regenerados na voz nova ao serem reproduzidos.
            </p>
          )}
          {estado === "concluido" && (
            <p className="text-sm text-green-700 mt-0.5">
              Todos os áudios foram atualizados para sua nova voz. ✓
            </p>
          )}
          {estado === "erro" && erroMsg && (
            <p className="text-sm text-red-700 mt-0.5">
              Erro: {erroMsg}. Tente novamente.
            </p>
          )}
        </div>
      </div>

      {/* Barra de progresso */}
      {estado === "regenerando" && (
        <div className="w-full bg-amber-100 rounded-full h-2.5 overflow-hidden">
          <div
            className="bg-amber-500 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${progresso}%` }}
            role="progressbar"
            aria-valuenow={progresso}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      )}

      {/* Botão */}
      {(estado === "idle" || estado === "erro") && totalStale > 0 && (
        <BotaoAtualizar onClick={handleAtualizarTodos} carregando={estaCarregando} />
      )}

      {/* Nota sobre regeneração lazy */}
      {estado === "idle" && (
        <p className="text-xs text-amber-600">
          Dica: mesmo sem clicar, cada sermão será regeneado automaticamente
          na próxima vez que alguém clicar em "Ouvir".
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Botão extraído para evitar narrowing indevido do TypeScript.
// Dentro de `(estado === "idle" || estado === "erro") && ...` o TS estreita
// o tipo de `estado` para `"idle" | "erro"`, tornando impossível comparar
// com `"invalidando"`. Passar `carregando` como prop booleana resolve.
// ---------------------------------------------------------------------------

function BotaoAtualizar({
  onClick,
  carregando,
}: {
  onClick: () => void;
  carregando: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={carregando}
      className="w-full sm:w-auto inline-flex items-center justify-center gap-2
                 rounded-lg bg-amber-600 hover:bg-amber-700 active:bg-amber-800
                 text-white text-sm font-medium px-4 py-2
                 disabled:opacity-60 disabled:cursor-not-allowed
                 transition-colors duration-150"
    >
      {carregando ? (
        <>
          <SpinnerIcon />
          Preparando…
        </>
      ) : (
        <>🔄 Atualizar todos para minha nova voz</>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Ícone de spinner simples
// ---------------------------------------------------------------------------

function SpinnerIcon() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12" cy="12" r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}