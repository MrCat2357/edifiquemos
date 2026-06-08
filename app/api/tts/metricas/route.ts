/**
 * app/api/tts/metricas/route.ts
 *
 * Prompt 7-C1.2 — API de métricas administrativas do sistema TTS.
 *
 * Autenticação: header Authorization: Bearer {TTS_ADMIN_SECRET}
 * Retorna 401 se ausente ou incorreto — nunca expõe dados sem autenticação.
 *
 * Todos os dados vêm do Firestore:
 *   - totalGeracoes, custoTotalUSD, custoMesAtualUSD → coleção tts_logs
 *   - postsComErro      → posts com audioStatus "error"
 *   - postsStuck        → posts com audioStatus "generating" > 10min
 *   - postsInvalidados  → posts com audioStatus "none" sem audioContentHash
 *                         (foram editados e aguardam regeneração)
 */

import { NextRequest, NextResponse } from "next/server";
import { getApps, getApp, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

// ---------------------------------------------------------------------------
// Firebase Admin — instância nomeada "tts-admin"
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
// Constante de timeout para postsStuck (10 minutos em ms)
// ---------------------------------------------------------------------------

const STUCK_TIMEOUT_MS = 10 * 60 * 1000;

// ---------------------------------------------------------------------------
// Handler GET
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  // ── Autenticação por TTS_ADMIN_SECRET ─────────────────────────────────────
  const adminSecret = process.env.TTS_ADMIN_SECRET;

  if (!adminSecret) {
    console.error("[TTS Métricas] TTS_ADMIN_SECRET não configurado.");
    return NextResponse.json({ error: "Configuração ausente no servidor." }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!bearerToken || bearerToken !== adminSecret) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  // ── Inicializar Firestore ─────────────────────────────────────────────────
  ensureAdminInitialized();
  const adminDb = getFirestore(getAdminApp());

  try {
    // ── 1. Métricas de custo a partir de tts_logs ─────────────────────────
    // Busca todos os logs de geração (sem o evento de invalidação)
    const logsSnap = await adminDb
      .collection("tts_logs")
      .where("storage", "==", "r2")
      .get();

    let totalGeracoes    = 0;
    let custoTotalUSD    = 0;
    let custoMesAtualUSD = 0;

    // Início do mês atual (meia-noite do dia 1)
    const agora         = new Date();
    const inicioMesAtual = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const inicioMesTs    = Timestamp.fromDate(inicioMesAtual);

    for (const doc of logsSnap.docs) {
      const d = doc.data();
      // Ignora entradas de invalidação — só contabiliza gerações reais
      if (d.evento === "invalidacao_por_edicao") continue;

      const custo = (d.estimatedCostUSD as number | undefined) ?? 0;
      totalGeracoes++;
      custoTotalUSD    += custo;

      const createdAt = d.createdAt as Timestamp | undefined;
      if (createdAt && createdAt.seconds >= inicioMesTs.seconds) {
        custoMesAtualUSD += custo;
      }
    }

    const storageR2GB = totalGeracoes * 0.005;

    // ── 2. Posts com erro (audioStatus === "error"), máximo 20 ────────────
    const erroSnap = await adminDb
      .collection("posts")
      .where("audioStatus", "==", "error")
      .limit(20)
      .get();

    const postsComErro = erroSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        postId:          doc.id,
        tipo:            (d.tipo            as string) ?? "",
        audioErrorCount: (d.audioErrorCount as number) ?? 0,
        titulo:          (d.titulo          as string) ?? "",
      };
    });

    // ── 3. Posts travados em "generating" há mais de 10min, máximo 20 ─────
    const stuckLimite = Timestamp.fromMillis(Date.now() - STUCK_TIMEOUT_MS);

    const stuckSnap = await adminDb
      .collection("posts")
      .where("audioStatus", "==", "generating")
      .where("audioUpdatedAt", "<", stuckLimite)
      .limit(20)
      .get();

    const postsStuck = stuckSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        postId:         doc.id,
        tipo:           (d.tipo           as string)    ?? "",
        audioUpdatedAt: (d.audioUpdatedAt as Timestamp) ?? null,
      };
    });

    // ── 4. Posts invalidados por edição aguardando regeneração ────────────
    // Critério: audioStatus "none" E campo audioContentHash ausente
    // (o invalidar/route.ts apaga audioContentHash via FieldValue.delete())
    const invalidadosSnap = await adminDb
      .collection("posts")
      .where("audioStatus", "==", "none")
      .limit(100) // busca mais para poder filtrar client-side no campo ausente
      .get();

    const postsInvalidados = invalidadosSnap.docs
      .filter((doc) => {
        const d = doc.data();
        // Só inclui posts que já tiveram áudio (têm tipo definido) mas
        // cujo hash foi apagado — indicando invalidação por edição
        return !d.audioContentHash && d.tipo;
      })
      .slice(0, 20)
      .map((doc) => {
        const d = doc.data();
        return {
          postId: doc.id,
          tipo:   (d.tipo   as string) ?? "",
          titulo: (d.titulo as string) ?? "",
        };
      });

    // ── Resposta ──────────────────────────────────────────────────────────
    return NextResponse.json({
      totalGeracoes,
      custoTotalUSD:    Math.round(custoTotalUSD    * 1_000_000) / 1_000_000,
      custoMesAtualUSD: Math.round(custoMesAtualUSD * 1_000_000) / 1_000_000,
      storageR2GB:      Math.round(storageR2GB      * 1_000)     / 1_000,
      postsComErro,
      postsStuck,
      postsInvalidados,
    });

  } catch (err) {
    console.error("[TTS Métricas] Erro ao consultar Firestore:", err);
    return NextResponse.json({ error: "Erro interno ao buscar métricas." }, { status: 500 });
  }
}