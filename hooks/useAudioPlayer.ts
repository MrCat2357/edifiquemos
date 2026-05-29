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
    registerOnEndedCallback,
    registerNavigationCallback,
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
  function playOrToggle(pub: AudioPublication): void {
    if (current?.id === pub.id) {
      toggle();
      return;
    }
    if (queue.length > 0) {
      const existeNaFila = queue.findIndex((p) => p.id === pub.id);
      if (existeNaFila >= 0) {
        playQueue(pub, queue, contextType);
        return;
      }
    }
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

    // Fase 6 — navegação entre páginas (autoplay ao terminar faixa)
    registerOnEndedCallback,

    // Fase 7 — navegação via botões prev/next do player
    registerNavigationCallback,

    // Utilitários
    isCurrentPublication,
    isCurrentlyPlaying,
    playOrToggle,
  };
}

export type { AudioPublication, AudioContextType };