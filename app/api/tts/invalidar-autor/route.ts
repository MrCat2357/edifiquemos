/**
 * app/api/tts/invalidar-autor/route.ts
 *
 * Fase 10 — Invalidação em batch dos áudios de um autor.
 *
 * POST → marca como "stale" todos os posts do autor cujo audioVoiceId
 *        difere do voiceId atual (ou null → novo voiceId, ou voiceId → null).
 *
 * Autenticação: Bearer token do próprio autor (Firebase ID Token).
 * Limite de batch: 500 documentos por operação (limite do Firestore).
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getApps, getApp, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp, WriteBatch } from "firebase-admin/firestore";

// ---------------------------------------------------------------------------
// Firebase Admin — instância nomeada "invalidar-admin"
// ---------------------------------------------------------------------------

const ADMIN_APP_NAME = "invalidar-admin";

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
// POST /api/tts/invalidar-autor
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  ensureAdminInitialized();

  const adminApp  = getAdminApp();
  const adminAuth = getAuth(adminApp);
  const adminDb   = getFirestore(adminApp);

  // ── 1. Autenticação ──────────────────────────────────────────────────────
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

  // ── 2. Buscar voiceId atual do autor ─────────────────────────────────────
  const userRef  = adminDb.collection("users").doc(uid);
  const userSnap = await userRef.get();
  const userData = userSnap.data() ?? {};

  // voiceId atual: string se ativo e "ready", null se removido/ausente
  const voiceStatus    = userData.voiceStatus as string | undefined;
  const voiceIdAtual: string | null =
    userData.voiceId && voiceStatus === "ready"
      ? (userData.voiceId as string)
      : null;

  // ── 3. Buscar todos os posts do autor ────────────────────────────────────
  // Paginamos em lotes de 500 para respeitar o limite do Firestore
  const BATCH_LIMIT = 500;

  let totalInvalidados = 0;
  let lastDoc: FirebaseFirestore.DocumentSnapshot | null = null;
  let temMais = true;

  while (temMais) {
    let query = adminDb
      .collection("posts")
      .where("autorId", "==", uid)
      .limit(BATCH_LIMIT);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();

    if (snapshot.empty) break;
    temMais = snapshot.size === BATCH_LIMIT;
    lastDoc = snapshot.docs[snapshot.docs.length - 1];

    // ── 4. Filtrar posts desatualizados ──────────────────────────────────
    // Um post está desatualizado se:
    //   a) audioVoiceId !== voiceIdAtual  (inclui null !== string e string !== null)
    //   b) audioStatus é "ready" ou "stale" (posts sem áudio não precisam ser invalidados)
    const docsParaInvalidar = snapshot.docs.filter((doc) => {
      const data         = doc.data();
      const audioStatus  = data.audioStatus  as string | undefined;
      const audioVoiceId = data.audioVoiceId as string | null | undefined;

      // Só invalida posts que já têm (ou tiveram) áudio gerado
      if (!["ready", "stale", "error"].includes(audioStatus ?? "")) return false;

      // Compara a voz usada na geração com a voz atual
      const voiceIdUsada = audioVoiceId ?? null;
      return voiceIdUsada !== voiceIdAtual;
    });

    if (docsParaInvalidar.length === 0) continue;

    // ── 5. Batch update ──────────────────────────────────────────────────
    const batch: WriteBatch = adminDb.batch();

    for (const doc of docsParaInvalidar) {
      batch.update(doc.ref, {
        audioStatus:    "stale",
        audioUpdatedAt: Timestamp.now(),
      });
    }

    await batch.commit();
    totalInvalidados += docsParaInvalidar.length;

    console.log(
      `[Invalidar] Autor ${uid}: ${docsParaInvalidar.length} posts marcados como stale neste lote`
    );
  }

  console.log(`[Invalidar] Total invalidado para autor ${uid}: ${totalInvalidados} posts`);

  return NextResponse.json({ invalidados: totalInvalidados });
}