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
  // Fase 3
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
  // Fase 3
  playQueue: (pub: AudioPublication, queue: AudioPublication[], context: AudioContextType) => void;
  playNext: () => void;
  playPrevious: () => void;
  // Fase 6 — navegação entre páginas
  registerOnEndedCallback: (cb: (() => void) | null) => void;
  // Fase 7 — callback de navegação para playNext/playPrevious (sincronização player ↔ página)
  // Quando registrado, playNext e playPrevious chamam este callback com o índice de destino
  // em vez de apenas avançar o áudio, permitindo que a página navegue automaticamente.
  registerNavigationCallback: (
    cb: ((direction: "next" | "previous", pub: AudioPublication) => void) | null
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

  // Fase 3
  const [queue, setQueue] = useState<AudioPublication[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [contextType, setContextType] = useState<AudioContextType>(null);

  // Refs para closures estáveis no evento ended
  const queueRef = useRef<AudioPublication[]>([]);
  const currentIndexRef = useRef(-1);
  queueRef.current = queue;
  currentIndexRef.current = currentIndex;

  // Fase 6 — callback registrado pela página atual para navegação entre rotas
  // Quando preenchido, o onEnded do áudio chama este callback ANTES de avançar
  // na fila interna, permitindo que a página navegue para o próximo post.
  const onEndedCallbackRef = useRef<(() => void) | null>(null);

  // Fase 7 — callback de navegação registrado pela página de post.
  // Quando preenchido, playNext e playPrevious chamam este callback com a
  // publicação de destino em vez de apenas avançar o áudio internamente.
  // Isso permite que a página navegue para a URL do próximo/anterior post
  // mantendo leitura e player sempre sincronizados.
  const navigationCallbackRef = useRef<
    ((direction: "next" | "previous", pub: AudioPublication) => void) | null
  >(null);

  const registerOnEndedCallback = useCallback((cb: (() => void) | null) => {
    onEndedCallbackRef.current = cb;
  }, []);

  const registerNavigationCallback = useCallback(
    (cb: ((direction: "next" | "previous", pub: AudioPublication) => void) | null) => {
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
    audio.addEventListener("canplay",   () => setIsLoading(false));
    audio.addEventListener("durationchange", () => setDuration(audio.duration || 0));
    audio.addEventListener("timeupdate", () => setCurrentTime(audio.currentTime));
    audio.addEventListener("play",  () => setIsPlaying(true));
    audio.addEventListener("pause", () => setIsPlaying(false));
    audio.addEventListener("error", () => {
      setIsLoading(false);
      setIsPlaying(false);
    });

    audio.addEventListener("ended", () => {
      setIsPlaying(false);

      const idx = currentIndexRef.current;
      const q   = queueRef.current;
      const hasNext = idx >= 0 && idx < q.length - 1;

      // Se há um callback de navegação registrado pela página atual,
      // delegamos para ele. Ele é responsável por navegar e iniciar o áudio.
      // Apenas chamamos se há próximo na fila (para não navegar sem destino).
      if (onEndedCallbackRef.current && hasNext) {
        onEndedCallbackRef.current();
        return;
      }

      // Comportamento padrão Fase 4: autoplay interno na fila sem navegação
      if (hasNext) {
        const nextIdx = idx + 1;
        const nextPub = q[nextIdx];
        setCurrentIndex(nextIdx);
        const a = audioRef.current;
        if (!a) return;
        a.src = nextPub.audioUrl;
        a.currentTime = 0;
        setCurrentTime(0);
        setDuration(0);
        setCurrent(nextPub);
        setIsLoading(true);
        playPromiseRef.current = a.play();
        playPromiseRef.current?.catch(() => {});
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

  const _playAudio = useCallback((pub: AudioPublication) => {
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
  }, [current]);

  // ── Ações públicas base ───────────────────────────────────────────────────

  const play = useCallback((pub: AudioPublication) => {
    _playAudio(pub);
  }, [_playAudio]);

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
      p.then(() => { audio.pause(); audio.src = ""; }).catch(() => {});
    } else {
      audio.pause();
      audio.src = "";
    }
    setCurrent(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    // Fase 3: limpar fila
    setQueue([]);
    setCurrentIndex(-1);
    setContextType(null);
    // Fase 6: limpar callbacks
    onEndedCallbackRef.current = null;
    navigationCallbackRef.current = null;
  }, []);

  // ── Fase 3: playQueue ─────────────────────────────────────────────────────

  const playQueue = useCallback((
    pub: AudioPublication,
    newQueue: AudioPublication[],
    context: AudioContextType,
  ) => {
    const filaLimpa = newQueue.filter((p) => !!p.audioUrl);
    const idx = filaLimpa.findIndex((p) => p.id === pub.id);

    setQueue(filaLimpa);
    setCurrentIndex(idx >= 0 ? idx : 0);
    setContextType(context);

    _playAudio(pub);
  }, [_playAudio]);

  // ── Fase 3: playNext ──────────────────────────────────────────────────────
  //
  // Se há um navigationCallback registrado (página de post ativa), chamamos
  // ele em vez de apenas avançar o áudio. O callback é responsável por
  // navegar para a URL do próximo post E iniciar o áudio. Isso garante que
  // a leitura e o player fiquem sempre sincronizados.

  const playNext = useCallback(() => {
    const idx = currentIndexRef.current;
    const q   = queueRef.current;
    if (idx < 0 || idx >= q.length - 1) return;

    const nextIdx = idx + 1;
    const nextPub = q[nextIdx];

    if (navigationCallbackRef.current) {
      // Atualiza o índice já, para que hasPrevious/hasNext reflitam o estado
      // correto enquanto a navegação ocorre.
      setCurrentIndex(nextIdx);
      navigationCallbackRef.current("next", nextPub);
      return;
    }

    setCurrentIndex(nextIdx);
    _playAudio(nextPub);
  }, [_playAudio]);

  // ── Fase 3: playPrevious ──────────────────────────────────────────────────

  const playPrevious = useCallback(() => {
    const audio = audioRef.current;
    const idx   = currentIndexRef.current;
    const q     = queueRef.current;

    // Se passou mais de 3s na faixa atual, apenas reinicia (sem navegar)
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    if (idx <= 0) return;

    const prevIdx = idx - 1;
    const prevPub = q[prevIdx];

    if (navigationCallbackRef.current) {
      setCurrentIndex(prevIdx);
      navigationCallbackRef.current("previous", prevPub);
      return;
    }

    setCurrentIndex(prevIdx);
    _playAudio(prevPub);
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
    // Fase 6
    registerOnEndedCallback,
    // Fase 7
    registerNavigationCallback,
  };

  return (
    <AudioContext.Provider value={value}>
      {children}
    </AudioContext.Provider>
  );
}