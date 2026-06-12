/**
 * app/api/slides/converter/route.ts
 *
 * POST /api/slides/converter
 *
 * Recebe { postId, slideArquivoUrl, slideFormato }, responde 202 imediatamente
 * e processa a conversão em background (fire-and-forget), igual ao padrão TTS.
 *
 * Fluxo:
 *  1. Baixa o arquivo original da URL (Firebase Storage ou R2)
 *  2. Converte para imagens PNG:
 *     - .pdf                       → pdf2pic (poppler/pdftoppm via sharp)
 *     - .pptx | .ppt | .odp | .key → LibreOffice headless → PDF → pdf2pic
 *  3. Faz upload de cada PNG para R2 em slides/{postId}/slide-{N}.png
 *  4. Atualiza Firestore: slides: [...urls], slideStatus: "ready"
 *  Em caso de erro grava slideStatus: "error" no Firestore.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuth }                    from "firebase-admin/auth";
import { getApps, getApp, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp }    from "firebase-admin/firestore";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { execSync }                   from "child_process";
import * as fs                        from "fs";
import * as path                      from "path";
import * as os                        from "os";

// ---------------------------------------------------------------------------
// Firebase Admin
// ---------------------------------------------------------------------------

const ADMIN_APP_NAME = "slides-admin";

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
// S3 / R2
// ---------------------------------------------------------------------------

function getS3Client(): S3Client {
  return new S3Client({
    region:   "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type SlideFormato = "pptx" | "ppt" | "odp" | "key" | "pdf";
type SlideStatus  = "none" | "processing" | "ready" | "error";

interface ConverterRequestBody {
  postId:          string;
  slideArquivoUrl: string;
  slideFormato:    SlideFormato;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Baixa um arquivo remoto e salva em disco, retorna o caminho local. */
async function baixarArquivo(url: string, destino: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao baixar arquivo: ${res.status} ${res.statusText}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destino, buffer);
}

/**
 * Converte um arquivo de apresentação (pptx/ppt/odp/key) para PDF
 * usando LibreOffice headless. Retorna o caminho do PDF gerado.
 */
function converterParaPDFcomLibreOffice(arquivoEntrada: string, dirSaida: string): string {
  // LibreOffice converte e salva no mesmo diretório com extensão .pdf
  const loCmd = process.env.LIBREOFFICE_PATH ?? "libreoffice";
  execSync(
    `${loCmd} --headless --convert-to pdf --outdir "${dirSaida}" "${arquivoEntrada}"`,
    { timeout: 120_000, stdio: "pipe" }
  );

  const baseName    = path.basename(arquivoEntrada, path.extname(arquivoEntrada));
  const pdfGerado   = path.join(dirSaida, `${baseName}.pdf`);
  if (!fs.existsSync(pdfGerado)) {
    throw new Error(`LibreOffice não gerou o PDF esperado em: ${pdfGerado}`);
  }
  return pdfGerado;
}

/**
 * Converte um PDF em imagens PNG usando pdftoppm (poppler-utils).
 * Retorna lista de caminhos dos PNGs gerados, ordenados por página.
 * Requer: apt-get install -y poppler-utils  (disponível no ambiente Linux)
 */
function converterPDFparaPNGs(pdfPath: string, dirSaida: string, prefixo = "slide"): string[] {
  const pdftoppm = process.env.PDFTOPPM_PATH ?? "pdftoppm";

  // -png -r 150 → 150 DPI, bom equilíbrio qualidade/tamanho
  execSync(
    `${pdftoppm} -png -r 150 "${pdfPath}" "${path.join(dirSaida, prefixo)}"`,
    { timeout: 180_000, stdio: "pipe" }
  );

  // pdftoppm gera: slide-1.png, slide-2.png … ou slide-01.png, slide-001.png etc.
  const pngs = fs
    .readdirSync(dirSaida)
    .filter((f) => f.startsWith(prefixo) && f.endsWith(".png"))
    .sort((a, b) => {
      const numA = parseInt(a.replace(/[^0-9]/g, ""), 10);
      const numB = parseInt(b.replace(/[^0-9]/g, ""), 10);
      return numA - numB;
    })
    .map((f) => path.join(dirSaida, f));

  if (pngs.length === 0) throw new Error("pdftoppm não gerou nenhuma imagem PNG.");
  return pngs;
}

/** Faz upload de um PNG para R2 e retorna a URL pública. */
async function uploadPNGparaR2(
  s3: S3Client,
  localPath: string,
  r2Key: string
): Promise<string> {
  const body = fs.readFileSync(localPath);
  await s3.send(
    new PutObjectCommand({
      Bucket:      process.env.R2_BUCKET_NAME!,
      Key:         r2Key,
      Body:        body,
      ContentType: "image/png",
    })
  );
  return `${process.env.R2_PUBLIC_URL}/${r2Key}`;
}

// ---------------------------------------------------------------------------
// Processamento em background
// ---------------------------------------------------------------------------

async function processarSlideEmBackground(
  postId:          string,
  slideArquivoUrl: string,
  slideFormato:    SlideFormato,
  adminDb:         ReturnType<typeof getFirestore>
): Promise<void> {
  const postRef = adminDb.collection("posts").doc(postId);
  const tmpDir  = fs.mkdtempSync(path.join(os.tmpdir(), `slide-${postId}-`));

  console.log(`[Slides] Iniciando conversão: ${postId} (${slideFormato})`);

  try {
    // ── 1. Baixar arquivo original ──────────────────────────────────────────
    const ext           = slideFormato.toLowerCase();
    const arquivoLocal  = path.join(tmpDir, `original.${ext}`);
    await baixarArquivo(slideArquivoUrl, arquivoLocal);
    console.log(`[Slides] Arquivo baixado: ${arquivoLocal}`);

    // ── 2. Obter PDF (direto ou via LibreOffice) ────────────────────────────
    let pdfPath: string;

    if (ext === "pdf") {
      pdfPath = arquivoLocal;
    } else {
      // .pptx / .ppt / .odp / .key → LibreOffice → PDF
      pdfPath = converterParaPDFcomLibreOffice(arquivoLocal, tmpDir);
      console.log(`[Slides] LibreOffice converteu para PDF: ${pdfPath}`);
    }

    // ── 3. PDF → PNGs ───────────────────────────────────────────────────────
    const pngPaths = converterPDFparaPNGs(pdfPath, tmpDir, "slide");
    console.log(`[Slides] ${pngPaths.length} imagem(ns) gerada(s)`);

    // ── 4. Upload de cada PNG para R2 ───────────────────────────────────────
    const s3   = getS3Client();
    const urls: string[] = [];

    for (let i = 0; i < pngPaths.length; i++) {
      const pageNum = i + 1;                                      // 1-based
      const r2Key   = `slides/${postId}/slide-${pageNum}.png`;
      const url     = await uploadPNGparaR2(s3, pngPaths[i], r2Key);
      urls.push(url);
      console.log(`[Slides] Imagem ${pageNum}/${pngPaths.length} enviada: ${url}`);
    }

    // ── 5. Atualizar Firestore ──────────────────────────────────────────────
    await postRef.set(
      {
        slides:          urls,
        slideStatus:     "ready" as SlideStatus,
        slidePageCount:  urls.length,
        slideUpdatedAt:  Timestamp.now(),
      },
      { merge: true }
    );

    console.log(`[Slides] Concluído: ${postId} (${urls.length} slides)`);
  } catch (err) {
    console.error(`[Slides] Erro ao processar ${postId}:`, err);

    try {
      await postRef.set(
        {
          slideStatus:    "error" as SlideStatus,
          slideUpdatedAt: Timestamp.now(),
          slideError:     err instanceof Error ? err.message : String(err),
        },
        { merge: true }
      );
    } catch (firestoreErr) {
      console.error(`[Slides] Falha ao gravar erro no Firestore para ${postId}:`, firestoreErr);
    }
  } finally {
    // Limpeza do diretório temporário
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

// ---------------------------------------------------------------------------
// Handler POST
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  ensureAdminInitialized();

  const adminApp  = getAdminApp();
  const adminAuth = getAuth(adminApp);
  const adminDb   = getFirestore(adminApp);

  // ── 1. Autenticação ────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  const idToken    = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  try {
    await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: "Token inválido ou expirado." }, { status: 401 });
  }

  // ── 2. Parse do body ───────────────────────────────────────────────────────
  let body: ConverterRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const { postId, slideArquivoUrl, slideFormato } = body;

  if (!postId)          return NextResponse.json({ error: "Campo obrigatório ausente: postId."          }, { status: 400 });
  if (!slideArquivoUrl) return NextResponse.json({ error: "Campo obrigatório ausente: slideArquivoUrl." }, { status: 400 });
  if (!slideFormato)    return NextResponse.json({ error: "Campo obrigatório ausente: slideFormato."    }, { status: 400 });

  const formatosAceitos: SlideFormato[] = ["pptx", "ppt", "odp", "key", "pdf"];
  if (!formatosAceitos.includes(slideFormato)) {
    return NextResponse.json({ error: `Formato não suportado: ${slideFormato}` }, { status: 400 });
  }

  // ── 3. Validar variáveis R2 ────────────────────────────────────────────────
  if (
    !process.env.R2_ACCOUNT_ID ||
    !process.env.R2_ACCESS_KEY_ID ||
    !process.env.R2_SECRET_ACCESS_KEY ||
    !process.env.R2_BUCKET_NAME ||
    !process.env.R2_PUBLIC_URL
  ) {
    console.error("[Slides] Variáveis R2 ausentes.");
    return NextResponse.json({ error: "Configuração de storage ausente." }, { status: 500 });
  }

  // ── 4. Verificar se o post existe ──────────────────────────────────────────
  const postRef  = adminDb.collection("posts").doc(postId);
  const postSnap = await postRef.get();
  if (!postSnap.exists) {
    return NextResponse.json({ error: "Post não encontrado." }, { status: 404 });
  }

  // Idempotência: se já está processando, não dispara novamente
  const currentStatus = postSnap.data()?.slideStatus as SlideStatus | undefined;
  if (currentStatus === "processing") {
    console.log(`[Slides] Post ${postId} já em processamento, ignorando.`);
    return NextResponse.json({ processando: true }, { status: 202 });
  }

  // ── 5. Marcar como "processing" ────────────────────────────────────────────
  await postRef.set(
    { slideStatus: "processing" as SlideStatus, slideUpdatedAt: Timestamp.now() },
    { merge: true }
  );

  // ── 6. Responder 202 e disparar background ─────────────────────────────────
  processarSlideEmBackground(postId, slideArquivoUrl, slideFormato, adminDb).catch((err) => {
    console.error(`[Slides FF] Erro inesperado no background para ${postId}:`, err);
  });

  return NextResponse.json({ iniciado: true }, { status: 202 });
}