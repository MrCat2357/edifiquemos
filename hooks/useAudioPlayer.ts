"use client";

import {
  useAudioContext,
  type AudioPublication,
  type AudioContextType,
  type PlaybackSpeed,
  type SleepTimerMode,
  type HistoryItem,
} from "@/providers/AudioProvider";

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
    preloadStatus,
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
    // Fase 11
    playbackSpeed,
    sleepTimer,
    sleepTimerRemaining,
    history,
    setPlaybackSpeed,
    setSleepTimer,
    clearHistory,
    playFromHistory,
  } = useAudioContext();

  // ── Utilitários de estado ──────────────────────────────────────────────────

  function isCurrentPublication(id: string): boolean {
    return current?.id === id;
  }

  function isCurrentlyPlaying(id: string): boolean {
    return current?.id === id && isPlaying;
  }

  // ── playOrToggle ──────────────────────────────────────────────────────────

  function playOrToggle(pub: AudioPublication): void {
    if (current?.id === pub.id) { toggle(); return; }
    if (queue.length > 0) {
      const existeNaFila = queue.findIndex((p) => p.id === pub.id);
      if (existeNaFila >= 0) { playQueue(pub, queue, contextType); return; }
    }
    play(pub);
  }

  // ── Utilitários de fila ───────────────────────────────────────────────────

  const hasNext     = currentIndex >= 0 && currentIndex < queue.length - 1;
  const hasPrevious = currentIndex > 0;

  // ── Fase 11: tempo restante da faixa ─────────────────────────────────────

  const timeRemaining = duration > 0 ? Math.max(0, duration - currentTime) : null;

  // ── Fase 11: helpers de sleep timer ──────────────────────────────────────

  function startSleepTimer(minutes: number) {
    setSleepTimer({
      type: "duration",
      minutes,
      endsAt: Date.now() + minutes * 60 * 1000,
    });
  }

  function setSleepAtEndOfTrack() {
    setSleepTimer({ type: "end_of_track" });
  }

  function cancelSleepTimer() {
    setSleepTimer({ type: "off" });
  }

  const sleepTimerActive = sleepTimer.type !== "off";

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

    // Preload (Fase 8)
    preloadStatus,

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

    // Callbacks
    registerOnEndedCallback,
    registerNavigationCallback,

    // Utilitários
    isCurrentPublication,
    isCurrentlyPlaying,
    playOrToggle,

    // ── Fase 11 ──────────────────────────────────────────────────────────
    playbackSpeed,
    setPlaybackSpeed,

    sleepTimer,
    sleepTimerRemaining,
    sleepTimerActive,
    startSleepTimer,
    setSleepAtEndOfTrack,
    cancelSleepTimer,
    setSleepTimer,

    timeRemaining,

    history,
    clearHistory,
    playFromHistory,
  };
}

export type { AudioPublication, AudioContextType, PlaybackSpeed, SleepTimerMode, HistoryItem };