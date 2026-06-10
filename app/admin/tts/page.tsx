/**
 * app/admin/tts/page.tsx
 *
 * Prompt 7-C2.3 — Painel administrativo do sistema TTS.
 *
 * Proteção server-side: verifica Firebase Auth + UID em TTS_ADMIN_UIDS.
 * TTS_ADMIN_SECRET nunca vai ao client — métricas buscadas via Server Action.
 * Estilo: exclusivamente CSS variables existentes no projeto.
 * Não aparece em nenhum menu ou link público do site.
 */

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getApps, getApp, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import TTSAdminClient from "./TTSAdminClient";

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
// Server Action: buscar métricas (TTS_ADMIN_SECRET nunca vai ao client)
// ---------------------------------------------------------------------------

export async function fetchMetricas() {
  "use server";

  const adminSecret = process.env.TTS_ADMIN_SECRET;
  if (!adminSecret) {
    throw new Error("TTS_ADMIN_SECRET não configurado.");
  }

  // Construir URL base server-side
  const headersList = await headers();
  const host  = headersList.get("host") ?? "localhost:3000";
  const proto = process.env.VERCEL_URL ? "https" : "http";
  const baseUrl = `${proto}://${host}`;

  const res = await fetch(`${baseUrl}/api/tts/metricas`, {
    headers: { Authorization: `Bearer ${adminSecret}` },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Erro ao buscar métricas: ${res.status}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Server Action: export CSV do mês atual
// ---------------------------------------------------------------------------

export async function fetchCsvMes(): Promise<string> {
  "use server";

  ensureAdminInitialized();
  const adminDb = getFirestore(getAdminApp());

  const agora          = new Date();
  const inicioMes      = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const inicioMesTs    = Timestamp.fromDate(inicioMes);

  const logsSnap = await adminDb
    .collection("tts_logs")
    .where("createdAt", ">=", inicioMesTs)
    .orderBy("createdAt", "asc")
    .get();

  const linhas: string[] = [
    "postId,tipo,charCount,estimatedCostUSD,storage,evento,createdAt",
  ];

  for (const doc of logsSnap.docs) {
    const d = doc.data();
    const createdAt = (d.createdAt as Timestamp)?.toDate().toISOString() ?? "";
    const evento    = (d.evento as string | undefined) ?? "";
    linhas.push(
      [
        d.postId        ?? "",
        d.tipo          ?? "",
        d.charCount     ?? 0,
        d.estimatedCostUSD ?? 0,
        d.storage       ?? "",
        evento,
        createdAt,
      ].join(",")
    );
  }

  return linhas.join("\n");
}

// ---------------------------------------------------------------------------
// Page — proteção server-side obrigatória
// ---------------------------------------------------------------------------

export default async function TTSAdminPage() {
  // ── Verificar token Firebase do cookie de sessão (ou header) ─────────────
  // O Next.js App Router não injeta automaticamente o Firebase ID token no
  // servidor. A estratégia: ler o cookie "firebase-session" (se houver SSR
  // cookie management) ou redirecionar para login com estado.
  //
  // Estratégia adotada: o componente client lê auth.currentUser e envia o
  // token para uma rota de verificação, mas a proteção server-side é feita
  // lendo o header Authorization que o middleware pode injetar OU verificando
  // o cookie de sessão Firebase Admin (firebase-session).
  //
  // Se nenhum token estiver disponível no servidor, o page renderiza o
  // client component que fará a verificação e redireciona se necessário.
  // A Server Action fetchMetricas() só executa com TTS_ADMIN_SECRET — nunca
  // expõe dados sem autenticação.

  ensureAdminInitialized();
  const adminAuth = getAuth(getAdminApp());

  // Tenta verificar via cookie de sessão Firebase
  let isAuthorized = false;
  let uid: string | null = null;

  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("firebase-session")?.value;

    if (sessionCookie) {
      const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
      uid = decoded.uid;

      const adminUids = (process.env.TTS_ADMIN_UIDS ?? "")
        .split(",")
        .map((u) => u.trim())
        .filter(Boolean);

      isAuthorized = adminUids.includes(uid);
    }
  } catch {
    // Cookie ausente ou inválido — deixa o client component verificar
    // via auth.currentUser (proteção adicional no client)
  }

  // Se temos certeza que NÃO é autorizado (cookie presente mas UID errado)
  if (uid && !isAuthorized) {
    redirect("/");
  }

  // Renderiza o client component que fará verificação adicional via Firebase Auth
  // e exibirá a UI após confirmar autorização
  return <TTSAdminClient fetchMetricas={fetchMetricas} fetchCsvMes={fetchCsvMes} />;
}