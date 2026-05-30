"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { auth } from "@/lib/firebase";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type AudioPublication = {
  id: string;
  tipo: "sermao" | "artigo" | "reflexao";
  titulo: string;
  autorNome: string;
  autorFoto?: string | null;
  slug: string;
  autorSlug?: string;
  audioUrl: string;
};

export type AudioContextType = "home" | "perfil" | "reflexoes" | "serie" | null;

// ─── Estado e ações ──────────────────────────────────────────────────────────

type AudioState = {
  current: AudioPublication | null;
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  volume: number;
  isLoading: boolean;
  queue: AudioPublication[];
  currentIndex: number;
  contextType: AudioContextType;
};

type AudioActions = {
  play: (pub: AudioPublication) => void;
  pause: () => void;
  resume: () => void;
  toggle: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
  close: () => void;
  playQueue: (
    pub: AudioPublication,
    queue: AudioPublication[],
    context: AudioContextType
  ) => void;
  playNext: () => void;
  playPrevious: () => void;
  registerOnEndedCallback: (cb: (() => void) | null) => void;
  registerNavigationCallback: (
    cb:
      | ((direction: "next" | "previous", pub: AudioPublication) => void)
      | null
  ) => void;
};

export type AudioContextValue = AudioState & AudioActions;

// ─── Context ─────────────────────────────────────────────────────────────────

const AudioContext = createContext<AudioContextValue | null>(null);

export function useAudioContext(): AudioContextValue {
  const ctx = useContext(AudioContext);
  if (!ctx) throw new Error("useAudioContext must be used inside AudioProvider");
  return ctx;
}

// ---------------------------------------------------------------------------
// Resolução de áudio via API TTS — usada dentro do Provider (sem hooks)
// ---------------------------------------------------------------------------

const FALLBACK_AUDIO = "https://archive.org/download/testmp3testfile/mpthreetest.mp3";

/**
 * Chama POST /api/tts/gerar diretamente (fetch com Bearer token).
 * Retorna a audioUrl gerada, ou null se falhar.
 * Não lança — falhas são silenciosas para não interromper o autoplay.
 */
async function resolverAudioUrlDireta(pub: AudioPublication): Promise<string | null> {
  // Se já tem URL válida (não é o fallback), retorna direto
  if (pub.audioUrl && pub.audioUrl !== FALLBACK_AUDIO) {
    return pub.audioUrl;
  }

  try {
    const user = auth.currentUser;
    if (!user) return null;

    const token = await user.getIdToken();

    const tipo = pub.tipo === "artigo" ? "estudo" : pub.tipo;

    const response = await fetch("/api/tts/gerar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        postId: pub.id,
        tipo,
        titulo: pub.titulo,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data?.audioUrl ?? null;
  } catch {
    return null;
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);

  const [current, setCurrent] = useState<AudioPublication | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const [queue, setQueue] = useState<AudioPublication[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [contextType, setContextType] = useState<AudioContextType>(null);

  // Refs para closures estáveis nos event listeners
  const queueRef = useRef<AudioPublication[]>([]);
  const currentIndexRef = useRef(-1);
  queueRef.current = queue;
  currentIndexRef.current = currentIndex;

  const onEndedCallbackRef = useRef<(() => void) | null>(null);
  const navigationCallbackRef = useRef<
    ((direction: "next" | "previous", pub: AudioPublication) => void) | null
  >(null);

  // Ref para evitar múltiplas resoluções TTS simultâneas no autoplay
  const resolvingNextRef = useRef(false);

  const registerOnEndedCallback = useCallback(
    (cb: (() => void) | null) => {
      onEndedCallbackRef.current = cb;
    },
    []
  );

  const registerNavigationCallback = useCallback(
    (
      cb:
        | ((direction: "next" | "previous", pub: AudioPublication) => void)
        | null
    ) => {
      navigationCallbackRef.current = cb;
    },
    []
  );

  // Cria o elemento <audio> uma única vez
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audio.volume = 1;

    audio.addEventListener("loadstart", () => setIsLoading(true));
    audio.addEventListener("canplay", () => setIsLoading(false));
    audio.addEventListener("durationchange", () =>
      setDuration(audio.duration || 0)
    );
    audio.addEventListener("timeupdate", () =>
      setCurrentTime(audio.currentTime)
    );
    audio.addEventListener("play", () => setIsPlaying(true));
    audio.addEventListener("pause", () => setIsPlaying(false));
    audio.addEventListener("error", () => {
      setIsLoading(false);
      setIsPlaying(false);
    });

    // ── Autoplay ao terminar a faixa — com resolução TTS ──────────────────
    //
    // Problema 3: quando o próximo item da fila usa FALLBACK_AUDIO (sem TTS
    // gerado), o autoplay tocava o MP3 mockado. Agora:
    //   1. Tenta resolver a audioUrl do próximo item via /api/tts/gerar.
    //   2. Se conseguir, usa a URL real; se falhar, pula para o item seguinte
    //      silenciosamente (sem interromper o fluxo).
    //   3. Só depois chama onEndedCallbackRef para navegação de página.
    audio.addEventListener("ended", () => {
      setIsPlaying(false);

      const idx = currentIndexRef.current;
      const q = queueRef.current;
      const hasNext = idx >= 0 && idx < q.length - 1;

      if (!hasNext) return;

      // Evita disparar múltiplas resoluções simultâneas
      if (resolvingNextRef.current) return;
      resolvingNextRef.current = true;

      // Busca o próximo item com URL válida, resolvendo TTS se necessário.
      // Itera a partir do próximo índice e pula quem falhar.
      (async () => {
        let tentativa = idx + 1;

        while (tentativa < q.length) {
          const candidato = q[tentativa];
          const url = await resolverAudioUrlDireta(candidato);

          if (url) {
            // Atualiza a URL na fila em memória para futuras navegações
            const novaFila = [...queueRef.current];
            novaFila[tentativa] = { ...candidato, audioUrl: url };
            setQueue(novaFila);

            const pubComUrl = { ...candidato, audioUrl: url };

            setCurrentIndex(tentativa);
            setCurrent(pubComUrl);
            setCurrentTime(0);
            setDuration(0);
            setIsLoading(true);

            const a = audioRef.current;
            if (a) {
              a.src = url;
              a.currentTime = 0;
              playPromiseRef.current = a.play();
              playPromiseRef.current?.catch(() => {});
            }

            // Navega a página depois de iniciar o áudio
            if (onEndedCallbackRef.current) {
              onEndedCallbackRef.current();
            }

            break;
          }

          // Esta faixa falhou — pula para a próxima
          tentativa += 1;
        }

        resolvingNextRef.current = false;
      })();
    });

    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, []);

  // ── Ação interna: tocar uma publicação no <audio> ─────────────────────────

  const _playAudio = useCallback(
    (pub: AudioPublication) => {
      const audio = audioRef.current;
      if (!audio) return;

      if (current?.id === pub.id) {
        playPromiseRef.current = audio.play();
        playPromiseRef.current?.catch(() => {});
        return;
      }

      audio.src = pub.audioUrl;
      audio.currentTime = 0;
      setCurrentTime(0);
      setDuration(0);
      setCurrent(pub);
      setIsLoading(true);
      playPromiseRef.current = audio.play();
      playPromiseRef.current?.catch(() => {});
    },
    [current]
  );

  // ── Ações públicas base ───────────────────────────────────────────────────

  const play = useCallback(
    (pub: AudioPublication) => {
      _playAudio(pub);
    },
    [_playAudio]
  );

  const pause = useCallback(() => {
    const p = playPromiseRef.current;
    if (p) {
      p.then(() => audioRef.current?.pause()).catch(() => {});
    } else {
      audioRef.current?.pause();
    }
  }, []);

  const resume = useCallback(() => {
    playPromiseRef.current = audioRef.current?.play() ?? null;
    playPromiseRef.current?.catch(() => {});
  }, []);

  const toggle = useCallback(() => {
    if (isPlaying) {
      const p = playPromiseRef.current;
      if (p) {
        p.then(() => audioRef.current?.pause()).catch(() => {});
      } else {
        audioRef.current?.pause();
      }
    } else {
      playPromiseRef.current = audioRef.current?.play() ?? null;
      playPromiseRef.current?.catch(() => {});
    }
  }, [isPlaying]);

  const seek = useCallback((time: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

  const setVolume = useCallback((vol: number) => {
    if (!audioRef.current) return;
    const clamped = Math.max(0, Math.min(1, vol));
    audioRef.current.volume = clamped;
    setVolumeState(clamped);
  }, []);

  const close = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const p = playPromiseRef.current;
    if (p) {
      p.then(() => {
        audio.pause();
        audio.src = "";
      }).catch(() => {});
    } else {
      audio.pause();
      audio.src = "";
    }
    setCurrent(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setQueue([]);
    setCurrentIndex(-1);
    setContextType(null);
    onEndedCallbackRef.current = null;
    navigationCallbackRef.current = null;
    resolvingNextRef.current = false;
  }, []);

  // ── playQueue ─────────────────────────────────────────────────────────────

  const playQueue = useCallback(
    (
      pub: AudioPublication,
      newQueue: AudioPublication[],
      context: AudioContextType
    ) => {
      const filaLimpa = newQueue.filter((p) => !!p.audioUrl);
      const idx = filaLimpa.findIndex((p) => p.id === pub.id);

      setQueue(filaLimpa);
      setCurrentIndex(idx >= 0 ? idx : 0);
      setContextType(context);

      _playAudio(pub);
    },
    [_playAudio]
  );

  // ── playNext — com resolução TTS ──────────────────────────────────────────
  //
  // Problema 3 (navegação manual): quando o usuário aperta "próximo" no player
  // e o item ainda não tem TTS gerado, resolve antes de tocar.

  const playNext = useCallback(() => {
    const idx = currentIndexRef.current;
    const q = queueRef.current;
    if (idx < 0 || idx >= q.length - 1) return;

    const nextIdx = idx + 1;
    const nextPub = q[nextIdx];

    // Se já tem URL válida, toca imediatamente
    if (nextPub.audioUrl && nextPub.audioUrl !== FALLBACK_AUDIO) {
      setCurrentIndex(nextIdx);
      _playAudio(nextPub);
      if (navigationCallbackRef.current) {
        navigationCallbackRef.current("next", nextPub);
      }
      return;
    }

    // Precisa gerar TTS — mostra loading e resolve assincronamente
    setCurrentIndex(nextIdx);
    setCurrent(nextPub);
    setIsLoading(true);

    if (navigationCallbackRef.current) {
      navigationCallbackRef.current("next", nextPub);
    }

    resolverAudioUrlDireta(nextPub).then((url) => {
      if (!url) {
        // Falhou — tenta o próximo item recursivamente se houver
        setIsLoading(false);
        const novoIdx = nextIdx + 1;
        if (novoIdx < queueRef.current.length) {
          const proximo = queueRef.current[novoIdx];
          setCurrentIndex(novoIdx);
          _playAudio(proximo);
        }
        return;
      }

      // Atualiza URL na fila
      const novaFila = [...queueRef.current];
      novaFila[nextIdx] = { ...nextPub, audioUrl: url };
      setQueue(novaFila);

      const pubComUrl = { ...nextPub, audioUrl: url };
      _playAudio(pubComUrl);
    });
  }, [_playAudio]);

  // ── playPrevious ──────────────────────────────────────────────────────────

  const playPrevious = useCallback(() => {
    const audio = audioRef.current;
    const idx = currentIndexRef.current;
    const q = queueRef.current;

    // Se passou mais de 3s na faixa atual, apenas reinicia (sem navegar)
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    if (idx <= 0) return;

    const prevIdx = idx - 1;
    const prevPub = q[prevIdx];

    setCurrentIndex(prevIdx);
    _playAudio(prevPub);

    if (navigationCallbackRef.current) {
      navigationCallbackRef.current("previous", prevPub);
    }
  }, [_playAudio]);

  // ── Value ─────────────────────────────────────────────────────────────────

  const value: AudioContextValue = {
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
  };

  return (
    <AudioContext.Provider value={value}>{children}</AudioContext.Provider>
  );
}