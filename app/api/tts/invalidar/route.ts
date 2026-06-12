/**
 * app/api/tts/invalidar/route.ts
 *
 * Invalidação proativa de cache de áudio quando um post é editado.
 * Chamado fire-and-forget pelos formulários de edição logo após o updateDoc.
 *
 * Contrato:
 *   POST /api/tts/invalidar
 *   Authorization: Bearer <idToken>
 *   Body: { postId: string; tipo: "sermao" | "estudo" | "reflexao" }
 *
 *   Resposta 200: { invalidado: true | false; motivo?: string }
 *
 * Comportamento:
 *   - Hash igual   → não faz nada (só metadados mudaram, conteúdo intacto)
 *   - Hash diverge → seta audioStatus = "stale" e inicia geração em background
 *                    via gerarAudioEmBackground() (chamada direta, sem HTTP)
 *   - Sempre retorna rápido — o save nunca fica bloqueado
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getApps, getApp, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { computarHashConteudo } from "@/lib/tts/hash";
import { gerarAudioEmBackground } from "@/lib/tts/gerarAudio";

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
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Body inválido." }, { status: 400 }); }

  const { postId, tipo } = body;
  if (!postId || !tipo) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes: postId, tipo." }, { status: 400 });
  }

  // ── Ler post ──────────────────────────────────────────────────────────────
  const postRef  = adminDb.collection("posts").doc(postId);
  const postSnap = await postRef.get();

  if (!postSnap.exists) {
    return NextResponse.json({ invalidado: false, motivo: "post_nao_encontrado" });
  }

  const postData         = postSnap.data() ?? {};
  const conteudo         = postData.conteudo         as string | undefined;
  const audioContentHash = postData.audioContentHash as string | undefined;

  if (!conteudo) {
    return NextResponse.json({ invalidado: false, motivo: "sem_conteudo" });
  }

  // ── Sem hash anterior: post nunca teve áudio gerado — nada a invalidar ────
  // A geração será disparada normalmente quando o player abrir o post.
  if (!audioContentHash) {
    return NextResponse.json({ invalidado: false, motivo: "sem_hash_anterior" });
  }

  // ── Comparar hashes ───────────────────────────────────────────────────────
  const novoHash = await computarHashConteudo(conteudo);

  if (audioContentHash === novoHash) {
    // Conteúdo não mudou (apenas título, igreja, data, links…)
    return NextResponse.json({ invalidado: false, motivo: "conteudo_inalterado" });
  }

  // ── Hash divergiu: marcar stale ───────────────────────────────────────────
  // Mantém audioUrl para o player continuar servindo o áudio antigo
  // enquanto o novo é gerado em background.
  try {
    await postRef.update({
      audioStatus:    "stale",
      audioUpdatedAt: Timestamp.now(),
    });
  } catch (err) {
    console.error(`[TTS invalidar] Erro ao marcar stale ${postId}:`, err);
    return NextResponse.json({ error: "Falha ao atualizar status." }, { status: 500 });
  }

  // ── Disparar geração em background ───────────────────────────────────────
  // Chamada direta ao módulo — sem HTTP, sem risco de token expirado.
  // O "tipo" do body pode ser "artigo"; normaliza para "estudo" aqui.
  const tipoNormalizado = (tipo === "artigo" ? "estudo" : tipo) as "sermao" | "estudo" | "reflexao";
  const titulo          = (postData.titulo as string | undefined) ?? "";

  gerarAudioEmBackground({
    postId,
    titulo,
    tipo:    tipoNormalizado,
    adminDb,
  }).catch((err) => {
    console.error(`[TTS invalidar] Erro na geração em background para ${postId}:`, err);
  });
  // Não await — retorna imediatamente abaixo

  // ── Log ───────────────────────────────────────────────────────────────────
  adminDb.collection("tts_logs").add({
    postId,
    tipo: tipoNormalizado,
    evento:       "invalidacao_por_edicao",
    novoHash,
    hashAnterior: audioContentHash,
    createdAt:    Timestamp.now(),
  }).catch(() => {});

  console.log(`[TTS invalidar] Stale + regeneração disparada: ${postId}`);

  return NextResponse.json({ invalidado: true });
}