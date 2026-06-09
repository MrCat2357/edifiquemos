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

// 8.2 — Status do preload do próximo item
export type PreloadStatus = "idle" | "loading" | "ready";

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
  /** 8.2 — Estado do preload do próximo item da fila */
  preloadStatus: PreloadStatus;
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

// ---------------------------------------------------------------------------
// 8.3 — Verificação de conexão lenta (Network Information API)
// ---------------------------------------------------------------------------

/**
 * Retorna true se a conexão for lenta demais para preload.
 * Silencioso em browsers sem suporte (Firefox, Safari) — retorna false.
 */
function isSlowConnection(): boolean {
  try {
    const conn = (navigator as any).connection;
    if (!conn) return false;
    return ["slow-2g", "2g"].includes(conn.effectiveType);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Preload do próximo item da fila — Fase 8 (adaptativo)
// ---------------------------------------------------------------------------

/**
 * Dispara GET /api/tts/preload para o próximo item.
 *
 * Fase 8 — Guards adicionais:
 *   8.1 — Não dispara se pausado há mais de 2 minutos
 *   8.1 — Não dispara se fila tem só 1 item
 *   8.3 — Não dispara em conexões slow-2g ou 2g
 *
 * Recebe setPreloadStatus para atualizar o indicador visual (8.2).
 * Retorna void — sempre fire-and-forget para o chamador.
 */
async function preloadProximo(
  queue: AudioPublication[],
  index: number,
  pausedSinceMs: number | null,
  setPreloadStatus: (s: PreloadStatus) => void
): Promise<void> {
  // 8.1 — Fila com só 1 item (ou menos): nada a pré-carregar
  if (queue.length <= 1) return;

  const proximo = queue[index + 1];
  if (!proximo) return;

  // Já tem URL válida — não precisa pré-carregar
  if (proximo.audioUrl && proximo.audioUrl !== FALLBACK_AUDIO) return;

  // 8.1 — Pausado há mais de 2 minutos: não desperdiçar recursos
  if (pausedSinceMs !== null) {
    const pausedDuration = Date.now() - pausedSinceMs;
    if (pausedDuration > 2 * 60 * 1000) {
      console.log("[AudioProvider] Preload ignorado: pausado há mais de 2 minutos.");
      return;
    }
  }

  // 8.3 — Conexão lenta: ignorar silenciosamente
  if (isSlowConnection()) {
    console.log("[AudioProvider] Preload ignorado: conexão lenta detectada.");
    return;
  }

  try {
    const user = auth.currentUser;
    if (!user) return;
    const token = await user.getIdToken();
    const tipo = proximo.tipo === "artigo" ? "estudo" : proximo.tipo;

    // 8.2 — Sinaliza que preload está em andamento
    setPreloadStatus("loading");

    console.log(`[AudioProvider] Preload iniciado para: ${proximo.titulo}`);

    const response = await fetch(
      `/api/tts/preload?postId=${proximo.id}&tipo=${tipo}&titulo=${encodeURIComponent(proximo.titulo)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (response.ok) {
      // 8.2 — HTTP 200 = cached: true → já está pronto
      const data = await response.json().catch(() => ({}));
      if (data?.cached === true) {
        setPreloadStatus("ready");
      } else {
        // HTTP 200 mas sem cached:true (improvável) → idle
        setPreloadStatus("idle");
      }
    } else if (response.status === 202) {
      // 8.2 — Em geração ou enfileirado → idle (não mostrar indicador)
      setPreloadStatus("idle");
    } else {
      setPreloadStatus("idle");
    }
  } catch {
    // Silencioso — preload nunca deve interromper a reprodução atual
    setPreloadStatus("idle");
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

  // 8.2 — Estado do preload
  const [preloadStatus, setPreloadStatus] = useState<PreloadStatus>("idle");

  // Refs para closures estáveis nos event listeners
  const queueRef = useRef<AudioPublication[]>([]);
  const currentIndexRef = useRef(-1);
  queueRef.current = queue;
  currentIndexRef.current = currentIndex;

  // 8.1 — Ref que registra quando o áudio pausou (timestamp em ms, ou null se tocando)
  const pausedSinceRef = useRef<number | null>(null);

  // Ref estável para setPreloadStatus (evita recrear closures)
  const setPreloadStatusRef = useRef(setPreloadStatus);
  setPreloadStatusRef.current = setPreloadStatus;

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

  // Helper estável para chamar preloadProximo com os guards da Fase 8
  const triggerPreload = useCallback(
    (q: AudioPublication[], idx: number) => {
      preloadProximo(
        q,
        idx,
        pausedSinceRef.current,
        setPreloadStatusRef.current
      );
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

    // 8.1 — Atualiza pausedSinceRef nos eventos play/pause
    audio.addEventListener("play", () => {
      setIsPlaying(true);
      pausedSinceRef.current = null; // tocando — reseta o contador de pausa
    });
    audio.addEventListener("pause", () => {
      setIsPlaying(false);
      if (pausedSinceRef.current === null) {
        pausedSinceRef.current = Date.now(); // registra início da pausa
      }
    });

    audio.addEventListener("error", () => {
      setIsLoading(false);
      setIsPlaying(false);
    });

    // ── Autoplay ao terminar a faixa — com resolução TTS ──────────────────
    audio.addEventListener("ended", () => {
      setIsPlaying(false);
      // ended = pausa natural; registra como início de pausa
      if (pausedSinceRef.current === null) {
        pausedSinceRef.current = Date.now();
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

            const a = audioRef.current;
            if (a) {
              a.src = url;
              a.currentTime = 0;
              playPromiseRef.current = a.play();
              playPromiseRef.current?.catch(() => {});
            }

            if (onEndedCallbackRef.current) {
              onEndedCallbackRef.current();
            }

            // Preload do próximo após avançar
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
      setPreloadStatus("idle");
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
    setPreloadStatus("idle");
    pausedSinceRef.current = null;
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
      setPreloadStatus("idle");

      _playAudio(pub);

      // Preload do próximo item — com guards da Fase 8
      // pausedSinceRef.current é null aqui (reprodução acabou de iniciar)
      triggerPreload(filaLimpa, idx >= 0 ? idx : 0);
    },
    [_playAudio, triggerPreload]
  );

  // ── playNext — com resolução TTS ──────────────────────────────────────────

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
      if (navigationCallbackRef.current) {
        navigationCallbackRef.current("next", nextPub);
      }
      triggerPreload(q, nextIdx);
      return;
    }

    setCurrentIndex(nextIdx);
    setCurrent(nextPub);
    setIsLoading(true);

    if (navigationCallbackRef.current) {
      navigationCallbackRef.current("next", nextPub);
    }

    resolverAudioUrlDireta(nextPub).then((url) => {
      if (!url) {
        setIsLoading(false);
        const novoIdx = nextIdx + 1;
        if (novoIdx < queueRef.current.length) {
          const proximo = queueRef.current[novoIdx];
          setCurrentIndex(novoIdx);
          _playAudio(proximo);
        }
        return;
      }

      const novaFila = [...queueRef.current];
      novaFila[nextIdx] = { ...nextPub, audioUrl: url };
      setQueue(novaFila);

      const pubComUrl = { ...nextPub, audioUrl: url };
      _playAudio(pubComUrl);

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
  };

  return (
    <AudioContext.Provider value={value}>{children}</AudioContext.Provider>
  );
}