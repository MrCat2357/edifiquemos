"use client";

import { useAudioContext, type AudioPublication } from "@/providers/AudioProvider";

/**
 * Hook público para interagir com o player global de áudio.
 *
 * Uso em qualquer Client Component:
 *
 *   const { play, pause, toggle, isPlaying, current } = useAudioPlayer();
 *
 *   // Iniciar reprodução de uma publicação:
 *   play({
 *     id: post.id,
 *     tipo: post.tipo,
 *     titulo: post.titulo,
 *     autorNome: post.autorNome,
 *     autorFoto: post.autorFoto,
 *     slug: post.slug,
 *     autorSlug: post.autorSlug,   // necessário para reflexões
 *     audioUrl: post.audioUrl,
 *   });
 *
 *   // Verificar se esta publicação específica está tocando:
 *   const estaAtivo  = current?.id === post.id;
 *   const estaTocando = estaAtivo && isPlaying;
 */
export function useAudioPlayer() {
  const {
    current,
    isPlaying,
    duration,
    currentTime,
    volume,
    isLoading,
    play,
    pause,
    resume,
    toggle,
    seek,
    setVolume,
    close,
  } = useAudioContext();

  /**
   * Retorna true se a publicação com o id fornecido é a que está
   * atualmente carregada no player (independente de estar pausada).
   */
  function isCurrentPublication(id: string): boolean {
    return current?.id === id;
  }

  /**
   * Retorna true se a publicação com o id fornecido está
   * ativamente tocando (carregada E em reprodução).
   */
  function isCurrentlyPlaying(id: string): boolean {
    return current?.id === id && isPlaying;
  }

  /**
   * Toggle inteligente: se a publicação já está no player, dá toggle.
   * Se for uma publicação diferente, inicia do zero.
   */
  function playOrToggle(pub: AudioPublication): void {
    if (current?.id === pub.id) {
      toggle();
    } else {
      play(pub);
    }
  }

  return {
    // Estado
    current,
    isPlaying,
    duration,
    currentTime,
    volume,
    isLoading,

    // Ações base
    play,
    pause,
    resume,
    toggle,
    seek,
    setVolume,
    close,

    // Utilitários
    isCurrentPublication,
    isCurrentlyPlaying,
    playOrToggle,
  };
}

export type { AudioPublication };