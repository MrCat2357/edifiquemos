/**
 * app/api/tts/gerar/route.ts
 *
 * Fase 10 — Suporte a audioStatus "stale" + gravação de audioVoiceId.
 * + Fire-and-forget: aceita chamada com apenas { postId } vindo do criar-post,
 *   busca titulo/tipo do Firestore, responde 202 imediatamente e processa
 *   em background.
 *
 * A lógica de geração em background foi extraída para lib/tts/gerarAudio.ts
 * e é compartilhada com app/api/tts/invalidar/route.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getApps, getApp, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import OpenAI from "openai";
import { computarHashConteudo } from "@/lib/tts/hash";
import { purgarCacheCloudflare } from "@/lib/tts/cloudflare";
import {
  gerarAudioEmBackground,
  limparConteudo,
  montarTextoTTS,
  dividirEmChunks,
} from "@/lib/tts/gerarAudio";

// ---------------------------------------------------------------------------
// Firebase Admin
// ---------------------------------------------------------------------------

const ADMIN_APP_NAME = "tts-admin";

function ensureAdminInitialized() {
  if (getApps().find((a) => a.name === ADMIN_APP_NAME)) return;
  const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? "")
    .replace(/^"|"$/g, "")
    .replace(/\\n/g, "\n");
  initializeApp(
    { credential: cert({ projectId: process.env.FIREBASE_ADMIN_PROJECT_ID, clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey }) },
    ADMIN_APP_NAME
  );
}

function getAdminApp() {
  ensureAdminInitialized();
  return getApp(ADMIN_APP_NAME);
}

// ---------------------------------------------------------------------------
// S3Client
// ---------------------------------------------------------------------------

function getS3Client(): S3Client {
  return new S3Client({
    region:   "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type AudioStatus = "none" | "generating" | "ready" | "error" | "stale";
type VoiceStatus = "none" | "processing" | "ready" | "error";

interface TTSRequestBody {
  postId:  string;
  tipo?:   "sermao" | "estudo" | "reflexao";
  titulo?: string;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const STUCK_GENERATING_TIMEOUT_MS = 10 * 60 * 1000;
const ELEVENLABS_MAX_CHARS        = 4500;

// ---------------------------------------------------------------------------
// Helpers locais (usados só no fluxo síncrono do player)
// ---------------------------------------------------------------------------

async function verificarUrlAcessivel(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(url, { method: "HEAD", signal: controller.signal });
    clearTimeout(timeoutId);
    return res.status >= 200 && res.status <= 299;
  } catch {
    return false;
  }
}

async function gerarBufferElevenLabs(voiceId: string, texto: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY não configurada.");
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text: texto, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true } }),
  });
  if (!res.ok) throw new Error(`ElevenLabs TTS ${res.status}: ${await res.text().catch(() => "")}`);
  return Buffer.from(await res.arrayBuffer());
}

async function gerarBuffersElevenLabs(voiceId: string, chunks: string[]): Promise<Buffer[]> {
  const buffers: Buffer[] = [];
  for (const chunk of chunks) buffers.push(await gerarBufferElevenLabs(voiceId, chunk));
  return buffers;
}

async function gerarBuffersOpenAI(openai: OpenAI, chunks: string[]): Promise<Buffer[]> {
  const buffers: Buffer[] = [];
  for (const chunk of chunks) {
    const r = await openai.audio.speech.create({ model: "tts-1", voice: "onyx", input: chunk, response_format: "mp3" });
    buffers.push(Buffer.from(await r.arrayBuffer()));
  }
  return buffers;
}

function removerHeaderID3(buffer: Buffer): Buffer {
  if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
    const tam = ((buffer[6] & 0x7f) << 21) | ((buffer[7] & 0x7f) << 14) | ((buffer[8] & 0x7f) << 7) | (buffer[9] & 0x7f);
    return buffer.slice(10 + tam);
  }
  return buffer;
}

function concatenarMP3s(buffers: Buffer[]): Buffer {
  if (buffers.length === 1) return buffers[0];
  return Buffer.concat(buffers.map((b, i) => (i === 0 ? b : removerHeaderID3(b))));
}

// ---------------------------------------------------------------------------
// Handler PATCH (ações administrativas)
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  ensureAdminInitialized();
  const adminApp  = getAdminApp();
  const adminAuth = getAuth(adminApp);
  const adminDb   = getFirestore(adminApp);

  const authHeader = req.headers.get("authorization") ?? "";
  const idToken    = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  let uid: string;
  try { const d = await adminAuth.verifyIdToken(idToken); uid = d.uid; }
  catch { return NextResponse.json({ error: "Token inválido ou expirado." }, { status: 401 }); }

  const adminUids = (process.env.TTS_ADMIN_UIDS ?? "").split(",").map((u) => u.trim()).filter(Boolean);
  if (!adminUids.includes(uid)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  let body: { postId?: string; action?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Body inválido." }, { status: 400 }); }

  const { postId, action } = body;
  if (!postId || !action) return NextResponse.json({ error: "Campos obrigatórios ausentes: postId, action." }, { status: 400 });
  if (!["reset", "reset_errors"].includes(action)) return NextResponse.json({ error: "action inválido." }, { status: 400 });

  const postRef  = adminDb.collection("posts").doc(postId);
  const postSnap = await postRef.get();
  if (!postSnap.exists) return NextResponse.json({ error: "Post não encontrado." }, { status: 404 });

  try {
    if (action === "reset") {
      await postRef.update({ audioStatus: "none", audioErrorCount: 0, audioUrl: FieldValue.delete(), audioContentHash: FieldValue.delete(), audioVoiceId: FieldValue.delete(), audioUpdatedAt: Timestamp.now() });
      return NextResponse.json({ ok: true, action: "reset", postId });
    }
    if (action === "reset_errors") {
      await postRef.update({ audioErrorCount: 0, audioUpdatedAt: Timestamp.now() });
      return NextResponse.json({ ok: true, action: "reset_errors", postId });
    }
  } catch (err) {
    console.error(`[TTS Admin] Erro ao executar ${action}:`, err);
    return NextResponse.json({ error: "Falha ao atualizar post." }, { status: 500 });
  }
  return NextResponse.json({ error: "Ação não executada." }, { status: 500 });
}

// ---------------------------------------------------------------------------
// Handler POST principal
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  ensureAdminInitialized();

  const adminApp  = getAdminApp();
  const adminAuth = getAuth(adminApp);
  const adminDb   = getFirestore(adminApp);

  // ── 1. Autenticação ───────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  const idToken    = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  try { await adminAuth.verifyIdToken(idToken); }
  catch { return NextResponse.json({ error: "Token inválido ou expirado." }, { status: 401 }); }

  // ── 2. Parse do body ──────────────────────────────────────────────────────
  let body: TTSRequestBody;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Body inválido." }, { status: 400 }); }

  const { postId } = body;
  let { tipo, titulo } = body;

  if (!postId) return NextResponse.json({ error: "Campo obrigatório ausente: postId." }, { status: 400 });

  const isFireAndForget = !tipo || !titulo;

  // ── 3. Variáveis R2 ───────────────────────────────────────────────────────
  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_BUCKET_NAME || !process.env.R2_PUBLIC_URL) {
    console.error("[TTS] Variáveis R2 ausentes.");
    return NextResponse.json({ error: "Configuração de storage ausente." }, { status: 500 });
  }

  // ── 4. Ler Firestore ──────────────────────────────────────────────────────
  const postRef  = adminDb.collection("posts").doc(postId);
  const postSnap = await postRef.get();
  const postData = postSnap.data() ?? {};

  const audioStatus      = postData.audioStatus      as AudioStatus | undefined;
  const audioUrl         = postData.audioUrl         as string | undefined;
  const audioErrorCount  = (postData.audioErrorCount as number | undefined) ?? 0;
  const audioContentHash = postData.audioContentHash as string | undefined;
  const audioUpdatedAt   = postData.audioUpdatedAt   as import("firebase-admin/firestore").Timestamp | undefined;
  const conteudo         = postData.conteudo         as string | undefined;
  const autorId          = postData.autorId          as string | undefined;

  if (!conteudo) return NextResponse.json({ error: "Campo 'conteudo' não encontrado." }, { status: 422 });

  // Resolve titulo e tipo do Firestore quando ausentes no body
  if (!titulo) {
    titulo = (postData.titulo as string | undefined) ?? "";
    if (!titulo) return NextResponse.json({ error: "Post sem título." }, { status: 422 });
  }
  if (!tipo) {
    const tipoRaw = postData.tipo as string | undefined;
    tipo = (tipoRaw === "artigo" ? "estudo" : tipoRaw) as "sermao" | "estudo" | "reflexao";
    if (!tipo || !["sermao", "estudo", "reflexao"].includes(tipo)) tipo = "sermao";
  }

  // ── 5. Buscar voiceId do autor ────────────────────────────────────────────
  let autorVoiceId: string | null = null;
  if (autorId) {
    try {
      const autorSnap = await adminDb.collection("users").doc(autorId).get();
      if (autorSnap.exists) {
        const d = autorSnap.data() ?? {};
        if (d.voiceId && (d.voiceStatus as VoiceStatus) === "ready") {
          autorVoiceId = d.voiceId as string;
          console.log(`[TTS] Voz clonada: ${autorId} → ${autorVoiceId}`);
        }
      }
    } catch (err) {
      console.warn("[TTS] Falha ao buscar voiceId (non-fatal):", err);
    }
  }

  // ── 6. Auto-recovery de posts travados ───────────────────────────────────
  if (audioStatus === "generating" && audioUpdatedAt) {
    const idadeMs = Date.now() - audioUpdatedAt.toMillis();
    if (idadeMs > STUCK_GENERATING_TIMEOUT_MS) {
      console.log(`[TTS] Post travado há ${Math.round(idadeMs / 60000)}min, resetando: ${postId}`);
      await postRef.set({ audioStatus: "none" as AudioStatus }, { merge: true });
    }
  }

  // ── 7. Rate limiting ──────────────────────────────────────────────────────
  if (audioStatus === "error" && audioErrorCount >= 3) {
    console.warn(`[TTS] Rate limit atingido: ${postId} (${audioErrorCount} erros)`);
    return NextResponse.json({ error: "Limite de tentativas atingido." }, { status: 429 });
  }

  // ── 8. Normalizar "stale" → "none" ────────────────────────────────────────
  const statusEfetivo: AudioStatus = audioStatus === "stale" ? "none" : (audioStatus ?? "none");

  if (statusEfetivo === "generating") {
    console.log(`[TTS] Post ${postId} já em geração.`);
    return NextResponse.json({ gerando: true });
  }

  // ── 9. Cache hit ou hash divergente ──────────────────────────────────────
  const hashAtual       = await computarHashConteudo(conteudo);
  const conteudoEditado = !audioContentHash || audioContentHash !== hashAtual;

  if (audioUrl && statusEfetivo === "ready") {
    if (conteudoEditado) {
      console.log(`[TTS] Hash diverge, regenerando: ${postId}`);
    } else {
      const urlAcessivel = await verificarUrlAcessivel(audioUrl);
      if (!urlAcessivel) {
        console.warn(`[TTS] URL inválida, regenerando: ${postId}`);
        await postRef.set({ audioStatus: "none" as AudioStatus }, { merge: true });
      } else {
        console.log(`[TTS] Cache hit: ${postId}`);
        return NextResponse.json({ audioUrl });
      }
    }
  }

  // ── 10. Marcar "generating" ───────────────────────────────────────────────
  await postRef.set({ audioStatus: "generating" as AudioStatus, audioUpdatedAt: Timestamp.now() }, { merge: true });

  // ── 11. Fire-and-forget (criar-post) → delega ao módulo compartilhado ─────
  if (isFireAndForget) {
    gerarAudioEmBackground({ postId, titulo, tipo, adminDb }).catch((err) => {
      console.error(`[TTS FF] Erro no background para ${postId}:`, err);
    });
    return NextResponse.json({ iniciado: true }, { status: 202 });
  }

  // ── A partir daqui: fluxo síncrono (chamado pelo player) ──────────────────

  const conteudoLimpo = limparConteudo(conteudo);
  const textoTTS = montarTextoTTS(
    titulo, conteudoLimpo, tipo,
    postData.autorNome        as string | undefined,
    postData.igreja           as string | undefined,
    postData.data             as string | undefined,
    postData.fraseInstigadora as string | undefined,
    postData.perguntaReflexiva as string | undefined,
  );

  // Geração síncrona
  let audioFinal: Buffer;
  let provedorUsado: "elevenlabs" | "openai";

  const gerarViaOpenAI = async (): Promise<Buffer> => {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return concatenarMP3s(await gerarBuffersOpenAI(openai, dividirEmChunks(textoTTS)));
  };

  try {
    if (autorVoiceId && process.env.ELEVENLABS_API_KEY) {
      audioFinal    = concatenarMP3s(await gerarBuffersElevenLabs(autorVoiceId, dividirEmChunks(textoTTS, ELEVENLABS_MAX_CHARS)));
      provedorUsado = "elevenlabs";
      console.log(`[TTS] ElevenLabs OK: ${postId}`);
    } else {
      audioFinal    = await gerarViaOpenAI();
      provedorUsado = "openai";
      console.log(`[TTS] OpenAI OK: ${postId}`);
    }
  } catch (err) {
    console.error("[TTS] Erro na geração:", err);
    if (autorVoiceId && process.env.OPENAI_API_KEY) {
      try {
        audioFinal    = await gerarViaOpenAI();
        provedorUsado = "openai";
        autorVoiceId  = null;
        console.log(`[TTS] Fallback OpenAI OK: ${postId}`);
      } catch (fe) {
        console.error("[TTS] Fallback falhou:", fe);
        await postRef.set({ audioStatus: "error" as AudioStatus, audioUpdatedAt: Timestamp.now(), audioErrorCount: audioErrorCount + 1 }, { merge: true });
        return NextResponse.json({ error: "Falha ao gerar áudio via TTS." }, { status: 502 });
      }
    } else {
      await postRef.set({ audioStatus: "error" as AudioStatus, audioUpdatedAt: Timestamp.now(), audioErrorCount: audioErrorCount + 1 }, { merge: true });
      return NextResponse.json({ error: "Falha ao gerar áudio via TTS." }, { status: 502 });
    }
  }

  // Upload R2
  const downloadURL = `${process.env.R2_PUBLIC_URL}/tts/posts/${postId}.mp3`;
  try {
    await getS3Client().send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: `tts/posts/${postId}.mp3`, Body: audioFinal!, ContentType: "audio/mpeg" }));
    purgarCacheCloudflare([downloadURL]).catch((e) => console.error("[TTS] Purge CF non-fatal:", e));
  } catch (err) {
    console.error("[TTS] Upload R2 falhou:", err);
    await postRef.set({ audioStatus: "error" as AudioStatus, audioUpdatedAt: Timestamp.now(), audioErrorCount: audioErrorCount + 1 }, { merge: true });
    return NextResponse.json({ error: "Falha ao salvar arquivo de áudio." }, { status: 502 });
  }

  // Salvar metadados
  try {
    await postRef.set({ audioUrl: downloadURL, audioStatus: "ready" as AudioStatus, audioUpdatedAt: Timestamp.now(), audioContentHash: hashAtual, audioErrorCount: 0, audioVoiceId: autorVoiceId }, { merge: true });
  } catch (err) {
    console.error("[TTS] Erro ao salvar Firestore:", err);
    return NextResponse.json({ error: "Áudio gerado, mas falha ao salvar metadados." }, { status: 207 });
  }

  adminDb.collection("tts_logs").add({ postId, tipo, charCount: textoTTS.length, estimatedCostUSD: provedorUsado === "elevenlabs" ? textoTTS.length / 1000 * 0.30 : textoTTS.length / 1_000_000 * 15, provedor: provedorUsado, voiceId: autorVoiceId ?? null, storage: "r2", createdAt: Timestamp.now() }).catch(() => {});

  return NextResponse.json({ audioUrl: downloadURL });
}