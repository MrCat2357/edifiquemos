/**
 * app/api/voice/preview/route.ts
 *
 * Fase 9 — Preview da voz clonada
 *
 * POST → gera um curto trecho de áudio usando a voz configurada pelo autor
 *        e retorna o buffer MP3 diretamente (sem salvar no R2)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getApps, getApp, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// ---------------------------------------------------------------------------
// Firebase Admin — instância nomeada "voice-preview-admin"
// ---------------------------------------------------------------------------

const ADMIN_APP_NAME = "voice-preview-admin";

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
// Texto de preview
// ---------------------------------------------------------------------------

const TEXTO_PREVIEW =
  "Que a graça e a paz de Deus nosso Pai e do Senhor Jesus Cristo sejam com vocês. " +
  "Esta é a minha voz, configurada para narrar sermões e estudos bíblicos nesta plataforma.";

// ---------------------------------------------------------------------------
// Geração via ElevenLabs
// ---------------------------------------------------------------------------

async function gerarPreviewElevenLabs(voiceId: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY não configurada.");

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: TEXTO_PREVIEW,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`ElevenLabs TTS ${res.status}: ${errBody}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

// ---------------------------------------------------------------------------
// Handler POST
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

  // ── Buscar voiceId do usuário ─────────────────────────────────────────────
  const userSnap = await adminDb.collection("users").doc(uid).get();
  const userData = userSnap.data() ?? {};

  const voiceId     = userData.voiceId     as string | undefined;
  const voiceStatus = userData.voiceStatus as string | undefined;

  if (!voiceId || voiceStatus !== "ready") {
    return NextResponse.json(
      { error: "Voz não configurada ou ainda em processamento." },
      { status: 409 }
    );
  }

  // ── Gerar preview ─────────────────────────────────────────────────────────
  let audioBuffer: Buffer;
  try {
    audioBuffer = await gerarPreviewElevenLabs(voiceId);
  } catch (err) {
    console.error("[Voice Preview] Erro ao gerar preview:", err);
    return NextResponse.json(
      { error: "Falha ao gerar preview da voz." },
      { status: 502 }
    );
  }

  return new NextResponse(new Uint8Array(audioBuffer), {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(audioBuffer.byteLength),
      "Cache-Control": "no-store",
    },
  });
}