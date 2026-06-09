/**
 * app/api/voice/create/route.ts
 *
 * Fase 9 — Clonagem de voz por autor
 *
 * POST  → cria a voz clonada a partir de uma amostra de áudio
 * DELETE → remove a voz do provedor e limpa o Firestore
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getApps, getApp, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

// ---------------------------------------------------------------------------
// Firebase Admin — instância nomeada "voice-admin"
// ---------------------------------------------------------------------------

const ADMIN_APP_NAME = "voice-admin";

function ensureAdminInitialized() {
  if (getApps().find((a) => a.name === ADMIN_APP_NAME)) return;

  const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? "")
    .replace(/^"|"$/g, "")
    .replace(/\\n/g, "\n");

  initializeApp(
    {
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey,
      }),
    },
    ADMIN_APP_NAME
  );
}

function getAdminApp() {
  ensureAdminInitialized();
  return getApp(ADMIN_APP_NAME);
}

// ---------------------------------------------------------------------------
// S3Client — Cloudflare R2
// ---------------------------------------------------------------------------

function getS3Client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

// ---------------------------------------------------------------------------
// Validações
// ---------------------------------------------------------------------------

const ALLOWED_AUDIO_TYPES = [
  "audio/mpeg",       // .mp3
  "audio/mp3",
  "audio/wav",        // .wav
  "audio/x-wav",
  "audio/wave",
  "audio/mp4",        // .m4a
  "audio/x-m4a",
  "audio/aac",
  "audio/ogg",
  "audio/webm",
];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// ---------------------------------------------------------------------------
// ElevenLabs — criação de voz clonada
// ---------------------------------------------------------------------------

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
}

async function criarVozElevenLabs(
  nomeVoz: string,
  audioBuffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY não configurada.");

  const formData = new FormData();
  formData.append("name", nomeVoz);
  formData.append("description", `Voz clonada para ${nomeVoz} — plataforma sermões`);

  const blob = new Blob([audioBuffer.buffer as ArrayBuffer], { type: mimeType });
  formData.append("files", blob, fileName);

  const res = await fetch("https://api.elevenlabs.io/v1/voices/add", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: formData,
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    console.error("[Voice] ElevenLabs error:", res.status, errorBody);
    throw new Error(`ElevenLabs retornou ${res.status}: ${errorBody}`);
  }

  const data = (await res.json()) as ElevenLabsVoice;
  return data.voice_id;
}

async function removerVozElevenLabs(voiceId: string): Promise<void> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return;

  const res = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
    method: "DELETE",
    headers: { "xi-api-key": apiKey },
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    console.warn("[Voice] ElevenLabs DELETE error:", res.status, errorBody);
    // Não lança erro — prossegue mesmo que o provider falhe
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extensaoPorMime(mime: string): string {
  const map: Record<string, string> = {
    "audio/mpeg": "mp3", "audio/mp3": "mp3",
    "audio/wav": "wav", "audio/x-wav": "wav", "audio/wave": "wav",
    "audio/mp4": "m4a", "audio/x-m4a": "m4a",
    "audio/aac": "aac",
    "audio/ogg": "ogg",
    "audio/webm": "webm",
  };
  return map[mime] ?? "bin";
}

// ---------------------------------------------------------------------------
// POST — criar voz
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  ensureAdminInitialized();

  const adminApp  = getAdminApp();
  const adminAuth = getAuth(adminApp);
  const adminDb   = getFirestore(adminApp);

  // ── Autenticação ──────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  const idToken    = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!idToken) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Token inválido ou expirado." }, { status: 401 });
  }

  // ── Validação de variáveis de ambiente ────────────────────────────────────
  if (
    !process.env.R2_ACCOUNT_ID ||
    !process.env.R2_ACCESS_KEY_ID ||
    !process.env.R2_SECRET_ACCESS_KEY ||
    !process.env.R2_BUCKET_NAME ||
    !process.env.R2_PUBLIC_URL
  ) {
    return NextResponse.json({ error: "Configuração de storage ausente." }, { status: 500 });
  }

  if (!process.env.ELEVENLABS_API_KEY) {
    return NextResponse.json({ error: "Provedor de voz não configurado." }, { status: 500 });
  }

  // ── Parse multipart ───────────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const file = formData.get("audio");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Campo 'audio' obrigatório (arquivo)." }, { status: 400 });
  }

  // ── Validação do arquivo ──────────────────────────────────────────────────
  const mimeType   = file.type || "audio/mpeg";
  const fileSize   = file.size;
  const fileName   = file.name || `amostra.${extensaoPorMime(mimeType)}`;

  if (!ALLOWED_AUDIO_TYPES.includes(mimeType)) {
    return NextResponse.json(
      { error: "Formato inválido. Use MP3, WAV, M4A, AAC, OGG ou WebM." },
      { status: 400 }
    );
  }

  if (fileSize > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: "Arquivo muito grande. Máximo permitido: 10 MB." },
      { status: 400 }
    );
  }

  const audioBuffer = Buffer.from(await file.arrayBuffer());

  // ── Buscar nome do autor no Firestore ─────────────────────────────────────
  const userRef  = adminDb.collection("users").doc(uid);
  const userSnap = await userRef.get();
  const userData = userSnap.data() ?? {};

  const nomeAutor: string =
    userData.titulo && userData.nome
      ? `${userData.titulo} ${userData.nome}`
      : userData.nome || "Autor";

  // Se já existe uma voz anterior, remove do provedor (mas não bloqueia em caso de falha)
  const voiceIdAnterior = userData.voiceId as string | undefined;
  if (voiceIdAnterior) {
    removerVozElevenLabs(voiceIdAnterior).catch((err) =>
      console.warn("[Voice] Falha ao remover voz antiga:", err)
    );
  }

  // ── Marcar como "processing" no Firestore ─────────────────────────────────
  await userRef.set(
    { voiceStatus: "processing", voiceUpdatedAt: Timestamp.now() },
    { merge: true }
  );

  // ── Upload da amostra para R2 ─────────────────────────────────────────────
  const ext         = extensaoPorMime(mimeType);
  const r2Key       = `voice-samples/${uid}/amostra.${ext}`;
  const sampleUrl   = `${process.env.R2_PUBLIC_URL}/${r2Key}`;

  try {
    await getS3Client().send(
      new PutObjectCommand({
        Bucket:      process.env.R2_BUCKET_NAME!,
        Key:         r2Key,
        Body:        audioBuffer,
        ContentType: mimeType,
      })
    );
  } catch (err) {
    console.error("[Voice] Erro ao fazer upload da amostra para R2:", err);
    await userRef.set(
      { voiceStatus: "error", voiceUpdatedAt: Timestamp.now() },
      { merge: true }
    );
    return NextResponse.json({ error: "Falha ao salvar amostra de voz." }, { status: 502 });
  }

  // ── Criar voz no ElevenLabs ───────────────────────────────────────────────
  let voiceId: string;
  try {
    voiceId = await criarVozElevenLabs(nomeAutor, audioBuffer, mimeType, fileName);
  } catch (err) {
    console.error("[Voice] Erro ao criar voz no ElevenLabs:", err);
    await userRef.set(
      { voiceStatus: "error", voiceUpdatedAt: Timestamp.now() },
      { merge: true }
    );
    return NextResponse.json(
      { error: "Falha ao criar voz clonada. Tente novamente." },
      { status: 502 }
    );
  }

  // ── Salvar no Firestore ───────────────────────────────────────────────────
  try {
    await userRef.set(
      {
        voiceId,
        voiceSampleUrl: sampleUrl,
        voiceStatus:    "ready",
        voiceProvider:  "elevenlabs",
        voiceUpdatedAt: Timestamp.now(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error("[Voice] Erro ao salvar voiceId no Firestore:", err);
    return NextResponse.json(
      { error: "Voz criada, mas falha ao salvar configuração." },
      { status: 207 }
    );
  }

  console.log(`[Voice] Voz criada com sucesso para uid=${uid}, voiceId=${voiceId}`);
  return NextResponse.json({ voiceId, voiceSampleUrl: sampleUrl });
}

// ---------------------------------------------------------------------------
// DELETE — remover voz
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest) {
  ensureAdminInitialized();

  const adminApp  = getAdminApp();
  const adminAuth = getAuth(adminApp);
  const adminDb   = getFirestore(adminApp);

  // ── Autenticação ──────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  const idToken    = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!idToken) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Token inválido ou expirado." }, { status: 401 });
  }

  const userRef  = adminDb.collection("users").doc(uid);
  const userSnap = await userRef.get();
  const userData = userSnap.data() ?? {};

  const voiceId      = userData.voiceId      as string | undefined;
  const voiceProvider = userData.voiceProvider as string | undefined;
  const ext          = (userData.voiceSampleUrl as string | undefined)?.split(".").pop() ?? "mp3";

  // ── Remover do provedor TTS ───────────────────────────────────────────────
  if (voiceId && voiceProvider === "elevenlabs") {
    await removerVozElevenLabs(voiceId).catch((err) =>
      console.warn("[Voice] Falha ao remover do ElevenLabs (non-fatal):", err)
    );
  }

  // ── Remover amostra do R2 ─────────────────────────────────────────────────
  if (
    process.env.R2_BUCKET_NAME &&
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY
  ) {
    const r2Key = `voice-samples/${uid}/amostra.${ext}`;
    await getS3Client()
      .send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: r2Key }))
      .catch((err) => console.warn("[Voice] Falha ao remover amostra do R2 (non-fatal):", err));
  }

  // ── Limpar Firestore ──────────────────────────────────────────────────────
  try {
    const { FieldValue } = await import("firebase-admin/firestore");
    await userRef.set(
      {
        voiceId:        FieldValue.delete(),
        voiceSampleUrl: FieldValue.delete(),
        voiceProvider:  FieldValue.delete(),
        voiceStatus:    "none",
        voiceUpdatedAt: Timestamp.now(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error("[Voice] Erro ao limpar Firestore:", err);
    return NextResponse.json({ error: "Falha ao remover configuração de voz." }, { status: 500 });
  }

  console.log(`[Voice] Voz removida para uid=${uid}`);
  return NextResponse.json({ ok: true });
}