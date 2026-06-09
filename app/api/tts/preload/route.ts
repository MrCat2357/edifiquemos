/**
 * app/api/tts/preload/route.ts
 *
 * Prompt 7-C2.1 — Preload contextual do próximo item da fila de áudio.
 *
 * Autenticação: Bearer token Firebase Auth (mesmo padrão do POST /api/tts/gerar).
 * Query params: postId, tipo, titulo
 *
 * Comportamento:
 *   - audioStatus "ready" e URL acessível  → { cached: true }            HTTP 200
 *   - audioStatus "generating"             → { cached: false, status: "generating" } HTTP 202
 *   - qualquer outro caso                  → inicia geração em background,
 *                                            { cached: false, status: "queued" }   HTTP 202
 *
 * ── Sobre waitUntil e background work na Vercel ──────────────────────────────
 *
 * O @vercel/functions waitUntil só está disponível no plano Pro+ (Fluid compute).
 * No plano Hobby a Vercel encerra a function assim que a Response é enviada,
 * tornando waitUntil ineficaz.
 *
 * Estratégia adotada: disparar a geração com fetch() fire-and-forget ANTES de
 * chamar NextResponse.json(). Enquanto a function ainda está "viva" (processando
 * a resposta de saída), o fetch para /api/tts/gerar já foi iniciado no event loop
 * do Node e tem chance de completar, especialmente para textos curtos.
 *
 * Tradeoff aceito: em planos Hobby, gerações longas podem ser truncadas quando a
 * Vercel encerra a sandbox. Isso é aceitável porque o preload é uma otimização de
 * UX — se for interrompido, o POST /api/tts/gerar será chamado normalmente quando
 * o usuário clicar em Ouvir, garantindo que o áudio sempre chega ao usuário.
 */

import { NextRequest, NextResponse } from "next/server";
import { getApps, getApp, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

// ---------------------------------------------------------------------------
// Firebase Admin — instância nomeada "tts-admin" (mesmo padrão dos outros routes)
// ---------------------------------------------------------------------------

const ADMIN_APP_NAME = "tts-admin";

function ensureAdminInitialized() {
  if (getApps().find((a) => a.name === ADMIN_APP_NAME)) return;

  const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? "")
    .replace(/^"|"$/g, "")
    .replace(/\\n/g, "\n");

  initializeApp(
    {
      credential: cert({
        projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID,
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
// Constante de timeout para auto-recovery (10 minutos — mesmo padrão do POST)
// ---------------------------------------------------------------------------

const STUCK_GENERATING_TIMEOUT_MS = 10 * 60 * 1000;

// ---------------------------------------------------------------------------
// Validação defensiva de URL cacheada (mesmo padrão do POST /api/tts/gerar)
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

// ---------------------------------------------------------------------------
// Handler GET
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  ensureAdminInitialized();

  const adminApp  = getAdminApp();
  const adminAuth = getAuth(adminApp);
  const adminDb   = getFirestore(adminApp);

  // ── 1. Autenticação Firebase Auth (Bearer token) ──────────────────────────
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

  // ── 2. Query params ───────────────────────────────────────────────────────
  const { searchParams } = new URL(req.url);
  const postId  = searchParams.get("postId");
  const tipo    = searchParams.get("tipo");
  const titulo  = searchParams.get("titulo");

  if (!postId || !tipo || !titulo) {
    return NextResponse.json(
      { error: "Query params obrigatórios ausentes: postId, tipo, titulo." },
      { status: 400 }
    );
  }

  if (!["sermao", "estudo", "reflexao"].includes(tipo)) {
    return NextResponse.json(
      { error: "Tipo inválido. Valores aceitos: sermao, estudo, reflexao." },
      { status: 400 }
    );
  }

  // ── 3. Consulta ao Firestore ───────────────────────────────────────────────
  const postRef  = adminDb.collection("posts").doc(postId);
  const postSnap = await postRef.get();
  const postData = postSnap.data() ?? {};

  const audioStatus    = postData.audioStatus    as string | undefined;
  const audioUrl       = postData.audioUrl       as string | undefined;
  const audioUpdatedAt = postData.audioUpdatedAt as Timestamp | undefined;

  // ── 4. Caso: já pronto e URL acessível → cache hit ────────────────────────
  if (audioStatus === "ready" && audioUrl) {
    const urlOk = await verificarUrlAcessivel(audioUrl);
    if (urlOk) {
      console.log(`[TTS Preload] Cache hit para post ${postId}`);
      return NextResponse.json({ cached: true }, { status: 200 });
    }
    // URL inacessível — cai no fluxo de queued abaixo
    console.warn(`[TTS Preload] URL cacheada inválida para post ${postId}, enfileirando regeneração.`);
  }

  // ── 5. Caso: gerando no momento → informa o client ───────────────────────
  //    (com proteção contra stuck — se travado há mais de 10min, trata como "none")
  if (audioStatus === "generating") {
    const idadeMs = audioUpdatedAt
      ? Date.now() - audioUpdatedAt.toMillis()
      : Infinity;

    if (idadeMs <= STUCK_GENERATING_TIMEOUT_MS) {
      console.log(`[TTS Preload] Post ${postId} já está sendo gerado.`);
      return NextResponse.json(
        { cached: false, status: "generating" },
        { status: 202 }
      );
    }
    // Travado — deixa cair no fluxo de queued para regenerar
    console.log(`[TTS Preload] Post ${postId} travado em generating há ${Math.round(idadeMs / 60000)}min, enfileirando.`);
  }

  // ── 6. Caso: qualquer outro → dispara geração em background e retorna 202 ─
  //
  // Estratégia fire-and-forget:
  // Iniciamos o fetch para /api/tts/gerar ANTES de retornar a resposta.
  // O idToken do usuário autenticado é reutilizado como Bearer para o POST,
  // garantindo que a geração passe pela mesma auth do POST original.
  //
  // O .catch(() => {}) garante que erros não propagam — o preload é best-effort.
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  fetch(`${baseUrl}/api/tts/gerar`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${idToken}`,
    },
    body: JSON.stringify({ postId, tipo, titulo }),
  }).catch((err) => {
    console.error(`[TTS Preload] Erro no background fetch para post ${postId}:`, err);
  });

  console.log(`[TTS Preload] Geração enfileirada em background para post ${postId} (uid: ${uid})`);

  return NextResponse.json(
    { cached: false, status: "queued" },
    { status: 202 }
  );
}