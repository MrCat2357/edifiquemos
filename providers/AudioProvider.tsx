"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

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

// ─── Estado e ações ───────────────────────────────────────────────────────────

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
};

export type AudioContextValue = AudioState & AudioActions;

// ─── Context ──────────────────────────────────────────────────────────────────

const AudioContext = createContext<AudioContextValue | null>(null);

export function useAudioContext(): AudioContextValue {
  const ctx = useContext(AudioContext);
  if (!ctx) throw new Error("useAudioContext must be used inside AudioProvider");
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
      // FASE 4 — autoplay contínuo
      const idx = currentIndexRef.current;
      const q   = queueRef.current;
      if (idx >= 0 && idx < q.length - 1) {
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
        a.play().catch(console.error);
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
      audio.play().catch(console.error);
      return;
    }

    audio.src = pub.audioUrl;
    audio.currentTime = 0;
    setCurrentTime(0);
    setDuration(0);
    setCurrent(pub);
    setIsLoading(true);
    audio.play().catch(console.error);
  }, [current]);

  // ── Ações públicas base (mantidas intactas) ───────────────────────────────

  const play = useCallback((pub: AudioPublication) => {
    _playAudio(pub);
  }, [_playAudio]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const resume = useCallback(() => {
    audioRef.current?.play().catch(console.error);
  }, []);

  const toggle = useCallback(() => {
    if (isPlaying) {
      audioRef.current?.pause();
    } else {
      audioRef.current?.play().catch(console.error);
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
    audio.pause();
    audio.src = "";
    setCurrent(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    // Fase 3: limpar fila
    setQueue([]);
    setCurrentIndex(-1);
    setContextType(null);
  }, []);

  // ── Fase 3: playQueue ─────────────────────────────────────────────────────

  const playQueue = useCallback((
    pub: AudioPublication,
    newQueue: AudioPublication[],
    context: AudioContextType,
  ) => {
    // Filtra itens sem audioUrl defensivamente
    const filaLimpa = newQueue.filter((p) => !!p.audioUrl);
    const idx = filaLimpa.findIndex((p) => p.id === pub.id);

    setQueue(filaLimpa);
    setCurrentIndex(idx >= 0 ? idx : 0);
    setContextType(context);

    _playAudio(pub);
  }, [_playAudio]);

  // ── Fase 3: playNext ──────────────────────────────────────────────────────

  const playNext = useCallback(() => {
    const idx = currentIndexRef.current;
    const q   = queueRef.current;
    if (idx < 0 || idx >= q.length - 1) return; // já é o último

    const nextIdx = idx + 1;
    const nextPub = q[nextIdx];
    setCurrentIndex(nextIdx);
    _playAudio(nextPub);
  }, [_playAudio]);

  // ── Fase 3: playPrevious ──────────────────────────────────────────────────

  const playPrevious = useCallback(() => {
    const audio = audioRef.current;
    const idx   = currentIndexRef.current;
    const q     = queueRef.current;

    // Se passou mais de 3s, reinicia a faixa atual em vez de voltar
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    if (idx <= 0) return; // já é o primeiro

    const prevIdx = idx - 1;
    const prevPub = q[prevIdx];
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
  };

  return (
    <AudioContext.Provider value={value}>
      {children}
    </AudioContext.Provider>
  );
}