/**
 * app/api/tts/regenerar-pendentes/route.ts
 *
 * Fase 10 — Regeneração proativa (background) de posts com audioStatus = "stale".
 *
 * GET → busca até MAX_POR_CHAMADA posts "stale" e dispara regeneração
 *       em fire-and-forget para cada um.
 *
 * Proteção: header "x-cron-secret" deve bater com a env CRON_SECRET.
 * Nunca exposta ao público — chamada apenas por Vercel Cron ou equivalente.
 *
 * Configurar em vercel.json:
 * {
 *   "crons": [{ "path": "/api/tts/regenerar-pendentes", "schedule": "0 * * * *" }]
 * }
 *
 * E definir o header no cron via middleware ou usar a validação abaixo com
 * a env CRON_SECRET no painel da Vercel.
 */

import { NextRequest, NextResponse } from "next/server";
import { getApps, getApp, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// ---------------------------------------------------------------------------
// Firebase Admin — instância nomeada "cron-admin"
// ---------------------------------------------------------------------------

const ADMIN_APP_NAME = "cron-admin";

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
// Limite por chamada — evita timeout na Vercel (máx. ~10s no plano Hobby)
// ---------------------------------------------------------------------------

const MAX_POR_CHAMADA = 10;

// ---------------------------------------------------------------------------
// GET /api/tts/regenerar-pendentes
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  // ── 1. Autenticação via secret header ────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[Cron] CRON_SECRET não definido — rota bloqueada.");
    return NextResponse.json({ error: "Configuração ausente." }, { status: 500 });
  }

  const headerSecret = req.headers.get("x-cron-secret");

  if (headerSecret !== cronSecret) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  // ── 2. Buscar posts stale ─────────────────────────────────────────────────
  ensureAdminInitialized();
  const adminDb = getFirestore(getAdminApp());

  const snapshot = await adminDb
    .collection("posts")
    .where("audioStatus", "==", "stale")
    .limit(MAX_POR_CHAMADA)
    .get();

  if (snapshot.empty) {
    console.log("[Cron] Nenhum post stale encontrado.");
    return NextResponse.json({ disparados: 0 });
  }

  // ── 3. Disparar regeneração fire-and-forget para cada post ───────────────
  const baseUrl = process.env.NEXTAUTH_URL ?? process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  // Usamos o CRON_SECRET também como token interno de serviço para
  // autenticar as chamadas à /api/tts/gerar sem precisar de um ID token real.
  // A rota /api/tts/gerar valida Firebase ID Token — por isso criamos um
  // token de serviço dedicado via custom token abaixo.
  // ALTERNATIVA MAIS SIMPLES: chamar a lógica de geração diretamente aqui,
  // o que evita a chamada HTTP interna. Optamos pela chamada HTTP para
  // reutilizar exatamente a mesma lógica (incluindo fallbacks e logs).

  const internalSecret = process.env.INTERNAL_API_SECRET;

  if (!internalSecret) {
    console.error("[Cron] INTERNAL_API_SECRET não definido.");
    return NextResponse.json({ error: "Configuração interna ausente." }, { status: 500 });
  }

  const posts = snapshot.docs.map((doc) => ({
    id:    doc.id,
    data:  doc.data(),
  }));

  // Fire-and-forget: não aguardamos as promessas
  for (const post of posts) {
    const { id, data } = post;

    fetch(`${baseUrl}/api/tts/gerar-interno`, {
      method: "POST",
      headers: {
        "Content-Type":       "application/json",
        "x-internal-secret":  internalSecret,
      },
      body: JSON.stringify({
        postId: id,
        tipo:   data.tipo   ?? "sermao",
        titulo: data.titulo ?? "",
      }),
    }).catch((err) => {
      console.error(`[Cron] Falha ao disparar regeneração do post ${id}:`, err);
    });
  }

  console.log(`[Cron] ${posts.length} posts stale disparados para regeneração.`);
  return NextResponse.json({ disparados: posts.length });
}