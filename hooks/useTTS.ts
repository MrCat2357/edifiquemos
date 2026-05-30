"use client";

import { useState, useRef } from "react";
import { auth } from "@/lib/firebase";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type TTSParams = {
  postId: string;
  tipo: "sermao" | "estudo" | "reflexao";
  titulo: string;
  /** Se presente e audioStatus === "ready", retorna diretamente sem chamar a API */
  audioUrlExistente?: string;
};

export type UseTTSResult = {
  /**
   * Resolve a audioUrl para um post:
   * - se audioUrlExistente está presente, retorna direto
   * - caso contrário, chama POST /api/tts/gerar e retorna a URL gerada
   * Lança erro se o usuário não estiver autenticado ou se a API falhar.
   */
  resolveAudioUrl: (params: TTSParams) => Promise<string>;
  isGenerating: boolean;
  error: string | null;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTTS(): UseTTSResult {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Proteção cliente: evita disparar nova chamada enquanto uma está em curso
  // (o audioStatus="generating" no Firestore é o lock do servidor)
  const generatingRef = useRef(false);

  async function resolveAudioUrl(params: TTSParams): Promise<string> {
    const { postId, tipo, titulo, audioUrlExistente } = params;

    // Bypass: URL já existe e está pronta — devolve sem gerar
    if (audioUrlExistente) {
      return audioUrlExistente;
    }

    // Proteção cliente contra chamadas simultâneas
    if (generatingRef.current) {
      throw new Error("Já existe uma geração em andamento.");
    }

    // Verifica autenticação
    const user = auth.currentUser;
    if (!user) {
      throw new Error("Usuário não autenticado.");
    }

    setIsGenerating(true);
    setError(null);
    generatingRef.current = true;

    try {
      const token = await user.getIdToken();

      const response = await fetch("/api/tts/gerar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ postId, tipo, titulo }),
      });

      const data = await response.json();

      if (!response.ok) {
        const msg = data?.error ?? `Erro ${response.status} ao gerar áudio.`;
        throw new Error(msg);
      }

      if (!data.audioUrl) {
        throw new Error("API não retornou audioUrl.");
      }

      return data.audioUrl as string;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido ao gerar áudio.";
      setError(msg);
      throw err;
    } finally {
      setIsGenerating(false);
      generatingRef.current = false;
    }
  }

  return { resolveAudioUrl, isGenerating, error };
}