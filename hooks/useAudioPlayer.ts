"use client";

import { useAudioContext, type AudioPublication, type AudioContextType } from "@/providers/AudioProvider";

export function useAudioPlayer() {
  const {
    current,
    isPlaying,
    duration,
    currentTime,
    volume,
    isLoading,
    queue,
    currentIndex,
    contextType,
    play,
    pause,
    resume,
    toggle,
    seek,
    setVolume,
    close,
    playQueue,
    playNext,
    playPrevious,
  } = useAudioContext();

  // ── Utilitários de estado ──────────────────────────────────────────────────

  /** True se a publicação está carregada no player (pausada ou tocando). */
  function isCurrentPublication(id: string): boolean {
    return current?.id === id;
  }

  /** True se a publicação está ativamente tocando. */
  function isCurrentlyPlaying(id: string): boolean {
    return current?.id === id && isPlaying;
  }

  // ── playOrToggle — compatibilidade com Fase 2 ─────────────────────────────
  /**
   * Mantido para compatibilidade.
   * Se já existe uma fila ativa, usa playQueue internamente para
   * preservar o contexto. Caso contrário, chama play() diretamente.
   */
  function playOrToggle(pub: AudioPublication): void {
    if (current?.id === pub.id) {
      toggle();
      return;
    }
    // Se já existe fila, insere a publicação no contexto atual
    if (queue.length > 0) {
      const existeNaFila = queue.findIndex((p) => p.id === pub.id);
      if (existeNaFila >= 0) {
        // Está na fila: navega para ela sem recriar a fila
        playQueue(pub, queue, contextType);
        return;
      }
    }
    // Sem fila: toca isolado (comportamento original da Fase 2)
    play(pub);
  }

  // ── Utilitários de fila ────────────────────────────────────────────────────

  /** True se há um próximo item na fila. */
  const hasNext = currentIndex >= 0 && currentIndex < queue.length - 1;

  /** True se há um item anterior na fila. */
  const hasPrevious = currentIndex > 0;

  return {
    // Estado base
    current,
    isPlaying,
    duration,
    currentTime,
    volume,
    isLoading,

    // Estado Fase 3
    queue,
    currentIndex,
    contextType,
    hasNext,
    hasPrevious,

    // Ações base
    play,
    pause,
    resume,
    toggle,
    seek,
    setVolume,
    close,

    // Ações Fase 3
    playQueue,
    playNext,
    playPrevious,

    // Utilitários
    isCurrentPublication,
    isCurrentlyPlaying,
    playOrToggle,
  };
}

export type { AudioPublication, AudioContextType };