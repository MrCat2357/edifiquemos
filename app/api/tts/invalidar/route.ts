/**
 * app/api/tts/invalidar/route.ts
 *
 * Invalidação proativa de cache de áudio quando um post é editado.
 *
 * Contrato:
 *   POST /api/tts/invalidar
 *   Authorization: Bearer <idToken>
 *   Body: { postId: string; tipo: "sermao" | "estudo" | "reflexao" }
 *
 *   Resposta 200: { invalidado: true | false; motivo?: string }
 *   Falhas: nunca devem quebrar o fluxo do chamador (fire-and-forget).
 *
 * Comportamento:
 *   - Se o hash do conteúdo atual divergir do audioContentHash salvo:
 *       → seta audioStatus = "stale"
 *       → dispara POST /api/tts/gerar fire-and-forget (sem bloquear)
 *   - Se o hash for igual (título/igreja/data mudaram, conteúdo não):
 *       → não faz nada
 *   - Sempre retorna rapidamente — nunca bloqueia o save
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getApps, getApp, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import { computarHashConteudo } from "@/lib/tts/hash";

// ---------------------------------------------------------------------------
// Firebase Admin — reutiliza a instância "tts-admin" se já inicializada
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
// Dispara regeneração de áudio em background — fire-and-forget
// Nunca lança exceção para o chamador.
// ---------------------------------------------------------------------------

async function dispararRegeneracao(
  postId:   string,
  tipo:     string,
  idToken:  string,
  baseUrl:  string,
): Promise<void> {
  try {
    await fetch(`${baseUrl}/api/tts/gerar`, {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "Authorization":     `Bearer ${idToken}`,
        "x-fire-and-forget": "1",
      },
      body: JSON.stringify({ postId, tipo }),
    });
  } catch (err) {
    // Falha silenciosa — regeneração será tentada pelo player ou pelo script
    console.warn(`[TTS invalidar] Falha ao disparar regeneração para ${postId} (non-fatal):`, err);
  }
}

// ---------------------------------------------------------------------------
// Handler
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

  try {
    await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: "Token inválido ou expirado." }, { status: 401 });
  }

  // ── Parse do body ─────────────────────────────────────────────────────────
  let body: { postId?: string; tipo?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const { postId, tipo } = body;

  if (!postId || !tipo) {
    return NextResponse.json(
      { error: "Campos obrigatórios ausentes: postId, tipo." },
      { status: 400 }
    );
  }

  // ── Ler post do Firestore ─────────────────────────────────────────────────
  const postRef  = adminDb.collection("posts").doc(postId);
  const postSnap = await postRef.get();

  if (!postSnap.exists) {
    return NextResponse.json({ invalidado: false, motivo: "post_nao_encontrado" });
  }

  const postData         = postSnap.data() ?? {};
  const conteudo         = postData.conteudo         as string | undefined;
  const audioContentHash = postData.audioContentHash as string | undefined;
  const audioStatus      = postData.audioStatus      as string | undefined;

  if (!conteudo) {
    return NextResponse.json({ invalidado: false, motivo: "sem_conteudo" });
  }

  // ── Calcular hash atual ───────────────────────────────────────────────────
  const novoHash = await computarHashConteudo(conteudo);

  // ── Sem hash anterior: nunca foi gerado áudio, nada a invalidar ───────────
  if (!audioContentHash) {
    return NextResponse.json({ invalidado: false, motivo: "sem_hash_anterior" });
  }

  // ── Hash igual: conteúdo não mudou (só metadados como título/igreja/data) ─
  if (audioContentHash === novoHash) {
    return NextResponse.json({ invalidado: false, motivo: "conteudo_inalterado" });
  }

  // ── Hash divergiu: marcar como "stale" ───────────────────────────────────
  // "stale" significa "áudio existe mas está desatualizado" — o player ainda
  // pode usá-lo enquanto o novo é gerado em background.
  try {
    await postRef.update({
      audioStatus:      "stale",
      audioUpdatedAt:   Timestamp.now(),
      // Mantém audioUrl e audioContentHash intactos para que o player
      // possa continuar servindo o áudio antigo enquanto o novo é gerado.
    });
  } catch (err) {
    console.error(`[TTS invalidar] Erro ao marcar stale para ${postId}:`, err);
    return NextResponse.json({ error: "Falha ao atualizar status." }, { status: 500 });
  }

  // ── Disparar regeneração em background ───────────────────────────────────
  // Resolve a URL base a partir do request para funcionar em qualquer ambiente
  // (localhost, staging, produção) sem variável de ambiente adicional.
  const baseUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  dispararRegeneracao(postId, tipo, idToken, baseUrl);
  // Não await — fire-and-forget puro

  // ── Log fire-and-forget ───────────────────────────────────────────────────
  adminDb.collection("tts_logs").add({
    postId,
    tipo,
    evento:    "invalidacao_por_edicao",
    novoHash,
    hashAnterior: audioContentHash,
    createdAt: Timestamp.now(),
  }).catch(() => {});

  console.log(`[TTS invalidar] Marcado como stale e regeneração disparada: ${postId}`);

  return NextResponse.json({ invalidado: true });
}