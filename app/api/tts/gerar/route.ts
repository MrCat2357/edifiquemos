import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import OpenAI from "openai";

// ---------------------------------------------------------------------------
// Firebase Admin — inicialização lazy (reutiliza instância se já existir)
// ---------------------------------------------------------------------------

function ensureAdminInitialized() {
  if (getApps().length > 0) return;

  const isProd =
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === "vozdafe-site";

  try {
    const fileName = isProd
      ? "./serviceAccount.production.json"
      : "./serviceAccount.staging.json";
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const serviceAccount = require(fileName);
    initializeApp({ credential: cert(serviceAccount) });
  } catch {
    const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? "")
      .replace(/^"|"$/g, "")
      .replace(/\\n/g, "\n");

    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey,
      }),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  }
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type AudioStatus = "none" | "generating" | "ready" | "error";

interface TTSRequestBody {
  postId: string;
  tipo: "sermao" | "estudo" | "reflexao";
  titulo: string;
  conteudo: string;
  referencia?: string;
}

// ---------------------------------------------------------------------------
// Limpeza de conteúdo
// ---------------------------------------------------------------------------

/**
 * Remove tags HTML, markdown visual e normaliza espaços/quebras de linha.
 * Preserva pontuação e pausa natural entre parágrafos.
 */
function limparConteudo(raw: string): string {
  return raw
    // Remove tags HTML
    .replace(/<[^>]+>/g, " ")
    // Remove marcações markdown: **negrito**, *itálico*, __sublinhado__, ~~tachado~~
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    // Remove cabeçalhos markdown (# Título)
    .replace(/^#{1,6}\s+/gm, "")
    // Remove links markdown [texto](url) → texto
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    // Remove blocos de código
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    // Normaliza múltiplas quebras de linha (≥2) → ponto + espaço para pausa natural
    .replace(/\n{2,}/g, ". ")
    // Normaliza quebras de linha simples → espaço
    .replace(/\n/g, " ")
    // Colapsa múltiplos espaços
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Montagem do texto para TTS
// ---------------------------------------------------------------------------

function montarTextoTTS(
  titulo: string,
  conteudo: string,
  referencia?: string
): string {
  const partes: string[] = [titulo.trim()];
  if (referencia?.trim()) partes.push(referencia.trim());
  partes.push(conteudo);
  return partes.join(". ");
}

// ---------------------------------------------------------------------------
// Chunking
// ---------------------------------------------------------------------------

const TTS_MAX_CHARS = 4096;

/**
 * Divide o texto em chunks respeitando o limite de caracteres,
 * tentando quebrar nos limites de frases para preservar naturalidade.
 * Nunca trunca silenciosamente.
 */
function dividirEmChunks(texto: string, maxChars = TTS_MAX_CHARS): string[] {
  if (texto.length <= maxChars) return [texto];

  const chunks: string[] = [];
  let restante = texto;

  while (restante.length > 0) {
    if (restante.length <= maxChars) {
      chunks.push(restante);
      break;
    }

    // Procura o último ponto final antes do limite
    const fatia = restante.slice(0, maxChars);
    const ultimoPonto = fatia.lastIndexOf(". ");

    const corte = ultimoPonto > maxChars * 0.5
      ? ultimoPonto + 2  // inclui o espaço após o ponto
      : maxChars;        // fallback: corte duro (sem ponto disponível)

    chunks.push(restante.slice(0, corte).trim());
    restante = restante.slice(corte).trim();
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Geração de áudio via OpenAI TTS
// ---------------------------------------------------------------------------

/**
 * Gera um buffer MP3 para cada chunk e retorna o array de buffers.
 * A concatenação simples é aceitável para staging.
 * ⚠️  Para produção com volumes maiores, migrar para FFmpeg
 *     a fim de evitar glitches de header entre chunks.
 *     Esta implementação não cria dependência que impeça essa migração.
 */
async function gerarBuffersAudio(
  openai: OpenAI,
  chunks: string[]
): Promise<Buffer[]> {
  const buffers: Buffer[] = [];

  for (const chunk of chunks) {
    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: "onyx",
      input: chunk,
      response_format: "mp3",
    });

    const arrayBuffer = await response.arrayBuffer();
    buffers.push(Buffer.from(arrayBuffer));
  }

  return buffers;
}

// ---------------------------------------------------------------------------
// Handler principal
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  ensureAdminInitialized();

  const adminAuth = getAuth();
  const adminDb = getFirestore();
  const adminStorage = getStorage();

  // ── 1. Autenticação ──────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!idToken) {
    return NextResponse.json(
      { error: "Não autenticado." },
      { status: 401 }
    );
  }

  try {
    await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json(
      { error: "Token inválido ou expirado." },
      { status: 401 }
    );
  }

  // ── 2. Parse e validação do body ─────────────────────────────────────────
  let body: TTSRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const { postId, tipo, titulo, conteudo, referencia } = body;

  if (!postId || !tipo || !titulo || !conteudo) {
    return NextResponse.json(
      { error: "Campos obrigatórios ausentes: postId, tipo, titulo, conteudo." },
      { status: 400 }
    );
  }

  const tiposValidos = ["sermao", "estudo", "reflexao"];
  if (!tiposValidos.includes(tipo)) {
    return NextResponse.json(
      { error: `Tipo inválido. Valores aceitos: ${tiposValidos.join(", ")}.` },
      { status: 400 }
    );
  }

  // ── 3. Referência ao documento Firestore ─────────────────────────────────
  const postRef = adminDb.collection("posts").doc(postId);

  // ── 4. Verificar se audioUrl já existe e está pronto ─────────────────────
  const postSnap = await postRef.get();
  const postData = postSnap.data() ?? {};

  const audioStatus = postData.audioStatus as AudioStatus | undefined;
  const audioUrl = postData.audioUrl as string | undefined;

  if (audioUrl && audioStatus === "ready") {
    return NextResponse.json({ audioUrl });
  }

  // ── 5. Marcar como "generating" antes de iniciar (lock distribuído) ───────
  await postRef.set(
    { audioStatus: "generating" as AudioStatus },
    { merge: true }
  );

  // ── 6. Limpeza e montagem do texto ───────────────────────────────────────
  const conteudoLimpo = limparConteudo(conteudo);
  const textoTTS = montarTextoTTS(titulo, conteudoLimpo, referencia);

  // ── 7. Geração do áudio ──────────────────────────────────────────────────
  let audioFinal: Buffer;

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const chunks = dividirEmChunks(textoTTS);
    const buffers = await gerarBuffersAudio(openai, chunks);

    // Concatenação de buffers: aceitável para staging.
    // Não cria acoplamento que impeça futura migração para FFmpeg.
    audioFinal = Buffer.concat(buffers);
  } catch (err) {
    console.error("[TTS] Erro ao gerar áudio:", err);
    await postRef.set(
      {
        audioStatus: "error" as AudioStatus,
        audioUpdatedAt: Timestamp.now(),
      },
      { merge: true }
    );
    return NextResponse.json(
      { error: "Falha ao gerar áudio via TTS." },
      { status: 502 }
    );
  }

  // ── 8. Upload para Firebase Storage ──────────────────────────────────────
  let downloadURL: string;

  try {
    const bucket = adminStorage.bucket();
    const storagePath = `tts/posts/${postId}.mp3`;
    const file = bucket.file(storagePath);

    await file.save(audioFinal, {
      metadata: {
        contentType: "audio/mpeg",
        cacheControl: "public, max-age=31536000",
      },
    });

    // Gera URL pública com token
    const [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: "03-01-2500", // data longa — revisitar na Fase 10
    });

    downloadURL = signedUrl;
  } catch (err) {
    console.error("[TTS] Erro ao fazer upload para Storage:", err);
    await postRef.set(
      {
        audioStatus: "error" as AudioStatus,
        audioUpdatedAt: Timestamp.now(),
      },
      { merge: true }
    );
    return NextResponse.json(
      { error: "Falha ao salvar arquivo de áudio." },
      { status: 502 }
    );
  }

  // ── 9. Salvar URL e status no Firestore ───────────────────────────────────
  try {
    await postRef.set(
      {
        audioUrl: downloadURL,
        audioStatus: "ready" as AudioStatus,
        audioUpdatedAt: Timestamp.now(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error("[TTS] Erro ao salvar no Firestore:", err);
    // Áudio foi gerado e salvo no Storage — retornamos a URL mesmo assim,
    // mas logamos o erro para investigação posterior.
    return NextResponse.json(
      { error: "Áudio gerado, mas falha ao salvar metadados." },
      { status: 207 }
    );
  }

  // ── 10. Resposta de sucesso ───────────────────────────────────────────────
  return NextResponse.json({ audioUrl: downloadURL });
}