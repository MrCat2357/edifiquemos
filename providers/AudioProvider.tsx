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
export type PreloadStatus = "idle" | "loading" | "ready";

// ── Fase 11 — novos tipos ────────────────────────────────────────────────────

export type PlaybackSpeed = 0.5 | 0.75 | 1 | 1.5 | 2;

export type SleepTimerMode =
  | { type: "off" }
  | { type: "duration"; minutes: number; endsAt: number }
  | { type: "end_of_track" };

export type HistoryItem = {
  id: string;
  tipo: AudioPublication["tipo"];
  titulo: string;
  autorNome: string;
  autorFoto?: string | null;
  slug: string;
  autorSlug?: string;
  audioUrl: string;
  playedAt: number;
};

// Persistência no localStorage
const LS_SPEED    = "audio_playback_speed";
const LS_HISTORY  = "audio_history";
const LS_RESUME   = "audio_resume_state";

const MAX_HISTORY = 20;

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
  preloadStatus: PreloadStatus;
  playbackSpeed: PlaybackSpeed;
  sleepTimer: SleepTimerMode;
  sleepTimerRemaining: number | null;
  history: HistoryItem[];
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
    cb: ((direction: "next" | "previous", pub: AudioPublication) => void) | null
  ) => void;
  setPlaybackSpeed: (speed: PlaybackSpeed) => void;
  setSleepTimer: (mode: SleepTimerMode) => void;
  clearHistory: () => void;
  playFromHistory: (item: HistoryItem) => void;
};

export type AudioContextValue = AudioState & AudioActions;

// ─── Context ─────────────────────────────────────────────────────────────────

const AudioContext = createContext<AudioContextValue | null>(null);

export function useAudioContext(): AudioContextValue {
  const ctx = useContext(AudioContext);
  if (!ctx) throw new Error("useAudioContext must be used inside AudioProvider");
  return ctx;
}

// ─── Helpers de localStorage ─────────────────────────────────────────────────

const VALID_SPEEDS: PlaybackSpeed[] = [0.5, 0.75, 1, 1.5, 2];

function loadSpeed(): PlaybackSpeed {
  try {
    const v = localStorage.getItem(LS_SPEED);
    if (v) {
      const n = parseFloat(v) as PlaybackSpeed;
      if (VALID_SPEEDS.includes(n)) return n;
    }
  } catch {}
  return 1;
}

function saveSpeed(speed: PlaybackSpeed) {
  try { localStorage.setItem(LS_SPEED, String(speed)); } catch {}
}

function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(LS_HISTORY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryItem[];
  } catch { return []; }
}

function saveHistory(items: HistoryItem[]) {
  try { localStorage.setItem(LS_HISTORY, JSON.stringify(items)); } catch {}
}

type ResumeState = {
  pub: AudioPublication;
  queue: AudioPublication[];
  currentIndex: number;
  contextType: AudioContextType;
  positionSeconds: number;
};

function loadResumeState(): ResumeState | null {
  try {
    const raw = localStorage.getItem(LS_RESUME);
    if (!raw) return null;
    return JSON.parse(raw) as ResumeState;
  } catch { return null; }
}

function saveResumeState(state: ResumeState) {
  try { localStorage.setItem(LS_RESUME, JSON.stringify(state)); } catch {}
}

function clearResumeState() {
  try { localStorage.removeItem(LS_RESUME); } catch {}
}

// ─── Resolução TTS ───────────────────────────────────────────────────────────

const FALLBACK_AUDIO = "https://archive.org/download/testmp3testfile/mpthreetest.mp3";

async function resolverAudioUrlDireta(pub: AudioPublication): Promise<string | null> {
  if (pub.audioUrl && pub.audioUrl !== FALLBACK_AUDIO) return pub.audioUrl;
  try {
    const user = auth.currentUser;
    if (!user) return null;
    const token = await user.getIdToken();
    const tipo = pub.tipo === "artigo" ? "estudo" : pub.tipo;
    const response = await fetch("/api/tts/gerar", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ postId: pub.id, tipo, titulo: pub.titulo }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data?.audioUrl ?? null;
  } catch { return null; }
}

// ─── Conexão lenta ───────────────────────────────────────────────────────────

function isSlowConnection(): boolean {
  try {
    const conn = (navigator as any).connection;
    if (!conn) return false;
    return ["slow-2g", "2g"].includes(conn.effectiveType);
  } catch { return false; }
}

// ─── Preload ─────────────────────────────────────────────────────────────────

async function preloadProximo(
  queue: AudioPublication[],
  index: number,
  pausedSinceMs: number | null,
  setPreloadStatus: (s: PreloadStatus) => void
): Promise<void> {
  if (queue.length <= 1) return;
  const proximo = queue[index + 1];
  if (!proximo) return;
  if (proximo.audioUrl && proximo.audioUrl !== FALLBACK_AUDIO) return;
  if (pausedSinceMs !== null && Date.now() - pausedSinceMs > 2 * 60 * 1000) return;
  if (isSlowConnection()) return;
  try {
    const user = auth.currentUser;
    if (!user) return;
    const token = await user.getIdToken();
    const tipo = proximo.tipo === "artigo" ? "estudo" : proximo.tipo;
    setPreloadStatus("loading");
    const response = await fetch(
      `/api/tts/preload?postId=${proximo.id}&tipo=${tipo}&titulo=${encodeURIComponent(proximo.titulo)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      setPreloadStatus(data?.cached === true ? "ready" : "idle");
    } else {
      setPreloadStatus("idle");
    }
  } catch { setPreloadStatus("idle"); }
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
  const [preloadStatus, setPreloadStatus] = useState<PreloadStatus>("idle");

  // ── Fase 11 ──────────────────────────────────────────────────────────────
  const [playbackSpeed, setPlaybackSpeedState] = useState<PlaybackSpeed>(1);
  const [sleepTimer, setSleepTimerState] = useState<SleepTimerMode>({ type: "off" });
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Refs
  const queueRef = useRef<AudioPublication[]>([]);
  const currentIndexRef = useRef(-1);
  const currentRef = useRef<AudioPublication | null>(null);
  queueRef.current = queue;
  currentIndexRef.current = currentIndex;
  currentRef.current = current;

  const pausedSinceRef = useRef<number | null>(null);
  const setPreloadStatusRef = useRef(setPreloadStatus);
  setPreloadStatusRef.current = setPreloadStatus;

  const onEndedCallbackRef = useRef<(() => void) | null>(null);
  const navigationCallbackRef = useRef<
    ((direction: "next" | "previous", pub: AudioPublication) => void) | null
  >(null);
  const resolvingNextRef = useRef(false);

  // Fase 11 refs
  const playbackSpeedRef = useRef<PlaybackSpeed>(1);
  const sleepTimerRef = useRef<SleepTimerMode>({ type: "off" });
  const sleepTimerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resumeSaveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const registerOnEndedCallback = useCallback((cb: (() => void) | null) => {
    onEndedCallbackRef.current = cb;
  }, []);

  const registerNavigationCallback = useCallback(
    (cb: ((direction: "next" | "previous", pub: AudioPublication) => void) | null) => {
      navigationCallbackRef.current = cb;
    },
    []
  );

  const triggerPreload = useCallback((q: AudioPublication[], idx: number) => {
    preloadProximo(q, idx, pausedSinceRef.current, setPreloadStatusRef.current);
  }, []);

  // ── Fase 11: carregar velocidade e histórico do localStorage ─────────────
  useEffect(() => {
    const speed = loadSpeed();
    setPlaybackSpeedState(speed);
    playbackSpeedRef.current = speed;

    const hist = loadHistory();
    setHistory(hist);
  }, []);

  // ── Fase 11: sleep timer tick ─────────────────────────────────────────────
  useEffect(() => {
    if (sleepTimerIntervalRef.current) {
      clearInterval(sleepTimerIntervalRef.current);
      sleepTimerIntervalRef.current = null;
    }

    if (sleepTimer.type === "off") {
      setSleepTimerRemaining(null);
      return;
    }

    if (sleepTimer.type === "end_of_track") {
      setSleepTimerRemaining(null);
      return;
    }

    if (sleepTimer.type === "duration") {
      const tick = () => {
        const remaining = Math.max(0, Math.round((sleepTimer.endsAt - Date.now()) / 1000));
        setSleepTimerRemaining(remaining);
        if (remaining <= 0) {
          const audio = audioRef.current;
          if (audio) {
            const p = playPromiseRef.current;
            if (p) p.then(() => audio.pause()).catch(() => {});
            else audio.pause();
          }
          setSleepTimerState({ type: "off" });
          setSleepTimerRemaining(null);
          if (sleepTimerIntervalRef.current) {
            clearInterval(sleepTimerIntervalRef.current);
            sleepTimerIntervalRef.current = null;
          }
        }
      };
      tick();
      sleepTimerIntervalRef.current = setInterval(tick, 1000);
    }

    return () => {
      if (sleepTimerIntervalRef.current) {
        clearInterval(sleepTimerIntervalRef.current);
        sleepTimerIntervalRef.current = null;
      }
    };
  }, [sleepTimer]);

  // ── Fase 11: salvar posição de retomada a cada 5s ────────────────────────
  useEffect(() => {
    if (resumeSaveIntervalRef.current) {
      clearInterval(resumeSaveIntervalRef.current);
      resumeSaveIntervalRef.current = null;
    }

    if (!current) return;

    resumeSaveIntervalRef.current = setInterval(() => {
      const audio = audioRef.current;
      if (!audio || !currentRef.current) return;
      saveResumeState({
        pub: currentRef.current,
        queue: queueRef.current,
        currentIndex: currentIndexRef.current,
        contextType: contextType ?? null,
        positionSeconds: audio.currentTime,
      });
    }, 5000);

    return () => {
      if (resumeSaveIntervalRef.current) {
        clearInterval(resumeSaveIntervalRef.current);
        resumeSaveIntervalRef.current = null;
      }
    };
  }, [current, contextType]);

  // ── Fase 11: helper para adicionar ao histórico ───────────────────────────
  const addToHistory = useCallback((pub: AudioPublication) => {
    setHistory((prev) => {
      const filtered = prev.filter((h) => h.id !== pub.id);
      const next: HistoryItem[] = [
        {
          id: pub.id,
          tipo: pub.tipo,
          titulo: pub.titulo,
          autorNome: pub.autorNome,
          autorFoto: pub.autorFoto,
          slug: pub.slug,
          autorSlug: pub.autorSlug,
          audioUrl: pub.audioUrl,
          playedAt: Date.now(),
        },
        ...filtered,
      ].slice(0, MAX_HISTORY);
      saveHistory(next);
      return next;
    });
  }, []);

  // ── Criar o elemento <audio> uma única vez ────────────────────────────────
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audio.volume = 1;
    audio.playbackRate = playbackSpeedRef.current;

    audio.addEventListener("loadstart", () => setIsLoading(true));
    audio.addEventListener("canplay", () => setIsLoading(false));
    audio.addEventListener("durationchange", () => setDuration(audio.duration || 0));
    audio.addEventListener("timeupdate", () => setCurrentTime(audio.currentTime));

    audio.addEventListener("play", () => {
      setIsPlaying(true);
      pausedSinceRef.current = null;
    });
    audio.addEventListener("pause", () => {
      setIsPlaying(false);
      if (pausedSinceRef.current === null) pausedSinceRef.current = Date.now();
    });
    audio.addEventListener("error", () => {
      setIsLoading(false);
      setIsPlaying(false);
    });

    audio.addEventListener("ended", () => {
      setIsPlaying(false);
      if (pausedSinceRef.current === null) pausedSinceRef.current = Date.now();

      if (sleepTimerRef.current.type === "end_of_track") {
        setSleepTimerState({ type: "off" });
        setSleepTimerRemaining(null);
        return;
      }

      const idx = currentIndexRef.current;
      const q = queueRef.current;
      const hasNext = idx >= 0 && idx < q.length - 1;
      if (!hasNext) return;
      if (resolvingNextRef.current) return;
      resolvingNextRef.current = true;

      (async () => {
        let tentativa = idx + 1;
        while (tentativa < q.length) {
          const candidato = q[tentativa];
          const url = await resolverAudioUrlDireta(candidato);
          if (url) {
            const novaFila = [...queueRef.current];
            novaFila[tentativa] = { ...candidato, audioUrl: url };
            setQueue(novaFila);
            const pubComUrl = { ...candidato, audioUrl: url };
            setCurrentIndex(tentativa);
            setCurrent(pubComUrl);
            setCurrentTime(0);
            setDuration(0);
            setIsLoading(true);
            setPreloadStatusRef.current("idle");
            audio.src = url.includes("?") ? url : `${url}?t=${Date.now()}`;
            audio.currentTime = 0;
            audio.playbackRate = playbackSpeedRef.current;
            playPromiseRef.current = audio.play();
            playPromiseRef.current?.catch(() => {});
            addToHistory(pubComUrl);
            if (onEndedCallbackRef.current) onEndedCallbackRef.current();
            preloadProximo(novaFila, tentativa, null, setPreloadStatusRef.current);
            break;
          }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── _playAudio ────────────────────────────────────────────────────────────

  const _playAudio = useCallback(
    (pub: AudioPublication) => {
      const audio = audioRef.current;
      if (!audio) return;
      if (current?.id === pub.id) {
        audio.playbackRate = playbackSpeedRef.current;
        playPromiseRef.current = audio.play();
        playPromiseRef.current?.catch(() => {});
        return;
      }
      audio.src = pub.audioUrl.includes("?") ? pub.audioUrl : `${pub.audioUrl}?t=${Date.now()}`;
      audio.currentTime = 0;
      audio.playbackRate = playbackSpeedRef.current;
      setCurrentTime(0);
      setDuration(0);
      setCurrent(pub);
      setIsLoading(true);
      setPreloadStatus("idle");
      addToHistory(pub);
      playPromiseRef.current = audio.play();
      playPromiseRef.current?.catch(() => {});
    },
    [current, addToHistory]
  );

  // ── Ações públicas base ───────────────────────────────────────────────────

  const play = useCallback((pub: AudioPublication) => { _playAudio(pub); }, [_playAudio]);

  const pause = useCallback(() => {
    const p = playPromiseRef.current;
    if (p) p.then(() => audioRef.current?.pause()).catch(() => {});
    else audioRef.current?.pause();
  }, []);

  const resume = useCallback(() => {
    playPromiseRef.current = audioRef.current?.play() ?? null;
    playPromiseRef.current?.catch(() => {});
  }, []);

  const toggle = useCallback(() => {
    if (isPlaying) {
      const p = playPromiseRef.current;
      if (p) p.then(() => audioRef.current?.pause()).catch(() => {});
      else audioRef.current?.pause();
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
    if (p) p.then(() => { audio.pause(); audio.src = ""; }).catch(() => {});
    else { audio.pause(); audio.src = ""; }
    setCurrent(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setQueue([]);
    setCurrentIndex(-1);
    setContextType(null);
    setPreloadStatus("idle");
    pausedSinceRef.current = null;
    onEndedCallbackRef.current = null;
    navigationCallbackRef.current = null;
    resolvingNextRef.current = false;
    clearResumeState();
  }, []);

  // ── playQueue ─────────────────────────────────────────────────────────────

  const playQueue = useCallback(
    (pub: AudioPublication, newQueue: AudioPublication[], context: AudioContextType) => {
      const filaLimpa = newQueue.filter((p) => !!p.audioUrl);
      const idx = filaLimpa.findIndex((p) => p.id === pub.id);
      setQueue(filaLimpa);
      setCurrentIndex(idx >= 0 ? idx : 0);
      setContextType(context);
      setPreloadStatus("idle");
      _playAudio(pub);
      triggerPreload(filaLimpa, idx >= 0 ? idx : 0);
    },
    [_playAudio, triggerPreload]
  );

  // ── playNext ──────────────────────────────────────────────────────────────

  const playNext = useCallback(() => {
    const idx = currentIndexRef.current;
    const q = queueRef.current;
    if (idx < 0 || idx >= q.length - 1) return;
    const nextIdx = idx + 1;
    const nextPub = q[nextIdx];
    setPreloadStatus("idle");
    if (nextPub.audioUrl && nextPub.audioUrl !== FALLBACK_AUDIO) {
      setCurrentIndex(nextIdx);
      _playAudio(nextPub);
      if (navigationCallbackRef.current) navigationCallbackRef.current("next", nextPub);
      triggerPreload(q, nextIdx);
      return;
    }
    setCurrentIndex(nextIdx);
    setCurrent(nextPub);
    setIsLoading(true);
    if (navigationCallbackRef.current) navigationCallbackRef.current("next", nextPub);
    resolverAudioUrlDireta(nextPub).then((url) => {
      if (!url) {
        setIsLoading(false);
        const novoIdx = nextIdx + 1;
        if (novoIdx < queueRef.current.length) {
          _playAudio(queueRef.current[novoIdx]);
          setCurrentIndex(novoIdx);
        }
        return;
      }
      const novaFila = [...queueRef.current];
      novaFila[nextIdx] = { ...nextPub, audioUrl: url };
      setQueue(novaFila);
      _playAudio({ ...nextPub, audioUrl: url });
      triggerPreload(novaFila, nextIdx);
    });
  }, [_playAudio, triggerPreload]);

  // ── playPrevious ──────────────────────────────────────────────────────────

  const playPrevious = useCallback(() => {
    const audio = audioRef.current;
    const idx = currentIndexRef.current;
    const q = queueRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    if (idx <= 0) return;
    const prevIdx = idx - 1;
    const prevPub = q[prevIdx];
    setCurrentIndex(prevIdx);
    setPreloadStatus("idle");
    _playAudio(prevPub);
    if (navigationCallbackRef.current) navigationCallbackRef.current("previous", prevPub);
  }, [_playAudio]);

  // ── Fase 11: setPlaybackSpeed ─────────────────────────────────────────────

  const setPlaybackSpeed = useCallback((speed: PlaybackSpeed) => {
    playbackSpeedRef.current = speed;
    setPlaybackSpeedState(speed);
    saveSpeed(speed);
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, []);

  // ── Fase 11: setSleepTimer ────────────────────────────────────────────────

  const setSleepTimer = useCallback((mode: SleepTimerMode) => {
    sleepTimerRef.current = mode;
    setSleepTimerState(mode);
  }, []);

  // ── Fase 11: clearHistory ─────────────────────────────────────────────────

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  // ── Fase 11: playFromHistory ──────────────────────────────────────────────

  const playFromHistory = useCallback(
    (item: HistoryItem) => {
      const pub: AudioPublication = {
        id: item.id,
        tipo: item.tipo,
        titulo: item.titulo,
        autorNome: item.autorNome,
        autorFoto: item.autorFoto,
        slug: item.slug,
        autorSlug: item.autorSlug,
        audioUrl: item.audioUrl,
      };
      _playAudio(pub);
      setQueue([pub]);
      setCurrentIndex(0);
      setContextType(null);
    },
    [_playAudio]
  );

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
    preloadStatus,
    playbackSpeed,
    sleepTimer,
    sleepTimerRemaining,
    history,
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
    setPlaybackSpeed,
    setSleepTimer,
    clearHistory,
    playFromHistory,
  };

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
}

// ── Fase 11: helper público para retomada automática ─────────────────────────
export function getResumeState(): ResumeState | null {
  return loadResumeState();
}

export function clearSavedResumeState() {
  clearResumeState();
}