"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

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

    // ── PROBLEMA 2 — Correção do evento "ended" ────────────────────────────
    //
    // Comportamento anterior (BUG):
    //   Se `onEndedCallbackRef` estava registrado, o provider fazia `return`
    //   ANTES de iniciar o próximo áudio — delegando a responsabilidade para
    //   a página. Resultado: a página navegava, mas o áudio ficava parado.
    //
    // Novo comportamento:
    //   1. Sempre avança o índice e inicia o próximo áudio imediatamente.
    //   2. Depois chama `onEndedCallbackRef` (se existir) apenas para
    //      navegação de página — sem afetar o áudio já iniciado.
    //
    // Isso garante que áudio e navegação são independentes e nunca ficam
    // dessincronizados.
    audio.addEventListener("ended", () => {
      setIsPlaying(false);

      const idx = currentIndexRef.current;
      const q = queueRef.current;
      const hasNext = idx >= 0 && idx < q.length - 1;

      if (!hasNext) return;

      const nextIdx = idx + 1;
      const nextPub = q[nextIdx];

      // ← ALTERADO: sempre avança e toca — sem verificar o callback antes
      setCurrentIndex(nextIdx);
      const a = audioRef.current;
      if (a) {
        a.src = nextPub.audioUrl;
        a.currentTime = 0;
        setCurrentTime(0);
        setDuration(0);
        setCurrent(nextPub);
        setIsLoading(true);
        playPromiseRef.current = a.play();
        playPromiseRef.current?.catch(() => {});
      }

      // ← ALTERADO: callback chamado DEPOIS de iniciar o áudio (só navega a página)
      if (onEndedCallbackRef.current) {
        onEndedCallbackRef.current();
      }
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

  // ── playNext ──────────────────────────────────────────────────────────────
  //
  // PROBLEMA 2 — Correção:
  //   Antes: se `navigationCallbackRef` estava registrado, o provider
  //   delegava tudo ao callback e não tocava o áudio.
  //   Resultado: a página navegava, mas o áudio ficava parado.
  //
  //   Agora: sempre avança o índice e toca o próximo áudio. Depois chama
  //   `navigationCallbackRef` (se existir) apenas para navegar a página.
  //   Dessa forma áudio e navegação são sempre independentes e síncronos.

  const playNext = useCallback(() => {
    const idx = currentIndexRef.current;
    const q = queueRef.current;
    if (idx < 0 || idx >= q.length - 1) return;

    const nextIdx = idx + 1;
    const nextPub = q[nextIdx];

    // ← ALTERADO: sempre avança e toca, independente de navigationCallback
    setCurrentIndex(nextIdx);
    _playAudio(nextPub);

    // ← ALTERADO: callback chamado DEPOIS de iniciar o áudio (só navega a página)
    if (navigationCallbackRef.current) {
      navigationCallbackRef.current("next", nextPub);
    }
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

    // ← ALTERADO: sempre recua e toca, independente de navigationCallback
    setCurrentIndex(prevIdx);
    _playAudio(prevPub);

    // ← ALTERADO: callback chamado DEPOIS de iniciar o áudio (só navega a página)
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