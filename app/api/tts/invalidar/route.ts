/**
 * app/api/tts/invalidar/route.ts
 *
 * Invalidação proativa de cache de áudio quando um post é editado.
 *
 * Por que esta rota existe:
 *   Os formulários de edição (sermões, estudos, reflexões) usam o Firebase
 *   SDK direto no client-side (updateDoc). Como a lógica de hash precisa
 *   rodar server-side com Firebase Admin, esta API Route é o ponto central
 *   de invalidação. Os pages de edição chamam este endpoint como
 *   fire-and-forget logo após o updateDoc bem-sucedido.
 *
 * Contrato:
 *   POST /api/tts/invalidar
 *   Authorization: Bearer <idToken>
 *   Body: { postId: string; tipo: "sermao" | "estudo" | "reflexao" }
 *
 *   Resposta 200: { invalidado: true | false; motivo?: string }
 *   Falhas: nunca devem quebrar o fluxo do chamador (fire-and-forget).
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getApps, getApp, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import { computarHashConteudo } from "@/lib/tts/hash";

// ---------------------------------------------------------------------------
// Firebase Admin — reutiliza a instância "tts-admin" se já inicializada
// (mesmo nome que route.ts — o singleton é compartilhado no mesmo processo)
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
// Handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  ensureAdminInitialized();

  const adminApp  = getAdminApp();
  const adminAuth = getAuth(adminApp);
  const adminDb   = getFirestore(adminApp);

  // ── Autenticação ─────────────────────────────────────────────────────────
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

  const postData        = postSnap.data() ?? {};
  const conteudo        = postData.conteudo as string | undefined;
  const audioContentHash = postData.audioContentHash as string | undefined;

  // Sem conteúdo ou sem hash anterior → nada a invalidar
  if (!conteudo) {
    return NextResponse.json({ invalidado: false, motivo: "sem_conteudo" });
  }

  if (!audioContentHash) {
    // Nunca teve áudio gerado — não precisa invalidar
    return NextResponse.json({ invalidado: false, motivo: "sem_hash_anterior" });
  }

  // ── Comparar hash ─────────────────────────────────────────────────────────
  const novoHash = computarHashConteudo(conteudo);

  if (audioContentHash === novoHash) {
    // Conteúdo não mudou (ex: só título ou campos opcionais foram editados)
    return NextResponse.json({ invalidado: false, motivo: "conteudo_inalterado" });
  }

  // ── Invalidar cache — sem deletar arquivo do R2 ───────────────────────────
  // O arquivo antigo no R2 será sobrescrito automaticamente na próxima geração.
  try {
    await postRef.update({
      audioStatus:       "none",
      audioUrl:          FieldValue.delete(),
      audioContentHash:  FieldValue.delete(),
    });
  } catch (err) {
    console.error(`[TTS] Erro ao invalidar cache do post ${postId}:`, err);
    return NextResponse.json({ error: "Falha ao invalidar cache." }, { status: 500 });
  }

  // ── Log de invalidação fire-and-forget ────────────────────────────────────
  adminDb.collection("tts_logs").add({
    postId,
    tipo,
    evento: "invalidacao_por_edicao",
    createdAt: Timestamp.now(),
  }).catch(() => {});

  console.log(`[TTS] Cache invalidado por edição: ${postId}`);

  return NextResponse.json({ invalidado: true });
}
