import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import OpenAI from "openai";

// ---------------------------------------------------------------------------
// Firebase Admin — inicialização lazy (reutiliza instância se já existir)
// ---------------------------------------------------------------------------

function ensureAdminInitialized() {
  if (getApps().length > 0) return;

  const isProd =
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === "vozdafe-site";

  try {
    const fileName = isProd
      ? "./serviceAccount.production.json"
      : "./serviceAccount.staging.json";
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const serviceAccount = require(fileName);
    initializeApp({ credential: cert(serviceAccount) });
  } catch {
    const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? "")
      .replace(/^"|"$/g, "")
      .replace(/\\n/g, "\n");

    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey,
      }),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  }
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type AudioStatus = "none" | "generating" | "ready" | "error";

interface TTSRequestBody {
  postId: string;
  tipo: "sermao" | "estudo" | "reflexao";
  titulo: string;
  conteudo: string;
  referencia?: string;
}

// ---------------------------------------------------------------------------
// Transliteração — Grego → Latino (padrão SBL simplificado)
// ---------------------------------------------------------------------------

/**
 * Detecta se uma string contém caracteres do alfabeto grego.
 */
function contemGrego(texto: string): boolean {
  return /[\u0370-\u03FF\u1F00-\u1FFF]/.test(texto);
}

/**
 * Detecta se uma string contém caracteres do alfabeto hebraico.
 */
function contemHebraico(texto: string): boolean {
  return /[\u0590-\u05FF]/.test(texto);
}

/**
 * Transliteração letra a letra do grego para o alfabeto latino,
 * seguindo o padrão SBL (Society of Biblical Literature) simplificado.
 * Lida com letras maiúsculas, minúsculas e diacríticos comuns.
 */
function transliterarGrego(palavra: string): string {
  // Mapa de caracteres gregos → transliteração latina
  const mapa: Record<string, string> = {
    // Alfa
    "α": "a", "ά": "a", "ὰ": "a", "ᾶ": "a", "ἀ": "a", "ἁ": "a",
    "ἂ": "a", "ἃ": "a", "ἄ": "a", "ἅ": "a", "ἆ": "a", "ἇ": "a",
    "ᾀ": "a", "ᾁ": "a", "ᾂ": "a", "ᾃ": "a", "ᾄ": "a", "ᾅ": "a",
    "ᾆ": "a", "ᾇ": "a", "ᾲ": "a", "ᾳ": "a", "ᾴ": "a", "ᾷ": "a",
    "Α": "A", "Ά": "A", "Ὰ": "A", "Ἀ": "A", "Ἁ": "A", "Ἂ": "A",
    "Ἃ": "A", "Ἄ": "A", "Ἅ": "A", "Ἆ": "A", "Ἇ": "A",
    // Beta
    "β": "b", "Β": "B",
    // Gamma
    "γ": "g", "Γ": "G",
    // Delta
    "δ": "d", "Δ": "D",
    // Epsilon
    "ε": "e", "έ": "e", "ὲ": "e", "ἐ": "e", "ἑ": "e", "ἒ": "e",
    "ἓ": "e", "ἔ": "e", "ἕ": "e",
    "Ε": "E", "Έ": "E", "Ὲ": "E", "Ἐ": "E", "Ἑ": "E", "Ἒ": "E",
    "Ἓ": "E", "Ἔ": "E", "Ἕ": "E",
    // Zeta
    "ζ": "z", "Ζ": "Z",
    // Eta (vogal longa ē)
    "η": "ē", "ή": "ē", "ὴ": "ē", "ῆ": "ē", "ἠ": "ē", "ἡ": "ē",
    "ἢ": "ē", "ἣ": "ē", "ἤ": "ē", "ἥ": "ē", "ἦ": "ē", "ἧ": "ē",
    "ῂ": "ē", "ῃ": "ē", "ῄ": "ē", "ῇ": "ē",
    "Η": "Ē", "Ή": "Ē", "Ὴ": "Ē", "Ἠ": "Ē", "Ἡ": "Ē", "Ἢ": "Ē",
    "Ἣ": "Ē", "Ἤ": "Ē", "Ἥ": "Ē", "Ἦ": "Ē", "Ἧ": "Ē",
    // Theta
    "θ": "th", "Θ": "Th",
    // Iota
    "ι": "i", "ί": "i", "ὶ": "i", "ῖ": "i", "ἰ": "i", "ἱ": "i",
    "ἲ": "i", "ἳ": "i", "ἴ": "i", "ἵ": "i", "ἶ": "i", "ἷ": "i",
    "ϊ": "i", "ΐ": "i",
    "Ι": "I", "Ί": "I", "Ὶ": "I", "Ἰ": "I", "Ἱ": "I", "Ἲ": "I",
    "Ἳ": "I", "Ἴ": "I", "Ἵ": "I", "Ἶ": "I", "Ἷ": "I",
    // Kappa
    "κ": "k", "Κ": "K",
    // Lambda
    "λ": "l", "Λ": "L",
    // Mu
    "μ": "m", "Μ": "M",
    // Nu
    "ν": "n", "Ν": "N",
    // Xi
    "ξ": "x", "Ξ": "X",
    // Omicron
    "ο": "o", "ό": "o", "ὸ": "o", "ὀ": "o", "ὁ": "o", "ὂ": "o",
    "ὃ": "o", "ὄ": "o", "ὅ": "o",
    "Ο": "O", "Ό": "O", "Ὸ": "O", "Ὀ": "O", "Ὁ": "O", "Ὂ": "O",
    "Ὃ": "O", "Ὄ": "O", "Ὅ": "O",
    // Pi
    "π": "p", "Π": "P",
    // Rho
    "ρ": "r", "ῥ": "rh", "ῤ": "r", "Ρ": "R", "Ῥ": "Rh",
    // Sigma
    "σ": "s", "ς": "s", "Σ": "S",
    // Tau
    "τ": "t", "Τ": "T",
    // Upsilon
    "υ": "y", "ύ": "y", "ὺ": "y", "ῦ": "y", "ὐ": "y", "ὑ": "y",
    "ὒ": "y", "ὓ": "y", "ὔ": "y", "ὕ": "y", "ὖ": "y", "ὗ": "y",
    "ϋ": "y", "ΰ": "y",
    "Υ": "Y", "Ύ": "Y", "Ὺ": "Y", "Ὑ": "Y", "Ὓ": "Y", "Ὕ": "Y", "Ὗ": "Y",
    // Phi
    "φ": "ph", "Φ": "Ph",
    // Chi
    "χ": "ch", "Χ": "Ch",
    // Psi
    "ψ": "ps", "Ψ": "Ps",
    // Omega (vogal longa ō)
    "ω": "ō", "ώ": "ō", "ὼ": "ō", "ῶ": "ō", "ὠ": "ō", "ὡ": "ō",
    "ὢ": "ō", "ὣ": "ō", "ὤ": "ō", "ὥ": "ō", "ὦ": "ō", "ὧ": "ō",
    "ῲ": "ō", "ῳ": "ō", "ῴ": "ō", "ῷ": "ō",
    "Ω": "Ō", "Ώ": "Ō", "Ὼ": "Ō", "Ὠ": "Ō", "Ὡ": "Ō", "Ὢ": "Ō",
    "Ὣ": "Ō", "Ὤ": "Ō", "Ὥ": "Ō", "Ὦ": "Ō", "Ὧ": "Ō",
  };

  return palavra
    .split("")
    .map((c) => mapa[c] ?? c)
    .join("");
}

/**
 * Transliteração letra a letra do hebraico para o alfabeto latino,
 * seguindo convenção acadêmica simplificada.
 */
function transliterarHebraico(palavra: string): string {
  const mapa: Record<string, string> = {
    "א": "", // alef — geralmente silencioso, omitido
    "בּ": "b", "ב": "v",
    "ג": "g",
    "ד": "d",
    "ה": "h",
    "ו": "v",
    "ז": "z",
    "ח": "kh",
    "ט": "t",
    "י": "y",
    "כ": "kh", "ך": "kh", "כּ": "k",
    "ל": "l",
    "מ": "m", "ם": "m",
    "נ": "n", "ן": "n",
    "ס": "s",
    "ע": "", // ain — geralmente silencioso, omitido
    "פ": "f", "ף": "f", "פּ": "p",
    "צ": "ts", "ץ": "ts",
    "ק": "q",
    "ר": "r",
    "ש": "sh", "שׁ": "sh", "שׂ": "s",
    "ת": "t",
    // Vogais (nikud)
    "\u05B0": "e", // shva
    "\u05B1": "e", // khataf segol
    "\u05B2": "a", // khataf patakh
    "\u05B3": "o", // khataf kamats
    "\u05B4": "i", // khirik
    "\u05B5": "e", // tsere
    "\u05B6": "e", // segol
    "\u05B7": "a", // patakh
    "\u05B8": "a", // kamats
    "\u05B9": "o", // kholam
    "\u05BA": "o", // kholam male
    "\u05BB": "u", // kubuts
    "\u05BC": "",  // dagesh — modifica a consoante, ignorado aqui
    "\u05C1": "",  // shin dot
    "\u05C2": "",  // sin dot
  };

  return palavra
    .split("")
    .map((c) => mapa[c] ?? c)
    .join("");
}

// ---------------------------------------------------------------------------
// Limpeza de conteúdo
// ---------------------------------------------------------------------------

/**
 * Estratégia para palavras em grego ou hebraico no texto:
 *
 * Caso 1 — palavra estrangeira SEGUIDA de transliteração entre parênteses:
 *   ex: "ἠγάπησεν (ēgapēsen)" → mantém só "(ēgapēsen)" sem os parênteses
 *   Resultado: "ēgapēsen"
 *
 * Caso 2 — palavra estrangeira SEM transliteração ao lado:
 *   ex: "ὁ θεὸς" → transliteração automática via mapa de caracteres
 *   Resultado: "ho theos"
 */
function processarTermosEstrangeiros(texto: string): string {
  // Caso 1: grego/hebraico seguido de transliteração entre parênteses
  // Ex: "ἠγάπησεν (ēgapēsen)" → "ēgapēsen"
  texto = texto.replace(
    /[\u0370-\u03FF\u1F00-\u1FFF\u0590-\u05FF\w\s]*?([\u0370-\u03FF\u1F00-\u1FFF\u0590-\u05FF]+[\w\s]*?)\s*\(([^)]+)\)/g,
    (match, _estrangeiro, transliteracao) => {
      // Só substitui se a palavra entre parênteses não contiver grego/hebraico
      if (contemGrego(transliteracao) || contemHebraico(transliteracao)) {
        return match; // deixa passar para o Caso 2
      }
      return transliteracao;
    }
  );

  // Caso 2: grego sem transliteração → transliteração automática
  texto = texto.replace(/[\u0370-\u03FF\u1F00-\u1FFF]+/g, (match) =>
    transliterarGrego(match)
  );

  // Caso 2: hebraico sem transliteração → transliteração automática
  texto = texto.replace(/[\u0590-\u05FF]+/g, (match) =>
    transliterarHebraico(match)
  );

  return texto;
}

/**
 * Remove tags HTML, markdown visual, processa termos estrangeiros
 * e normaliza espaços/quebras de linha.
 * Preserva pontuação e pausa natural entre parágrafos.
 */
function limparConteudo(raw: string): string {
  return raw
    // Remove tags HTML
    .replace(/<[^>]+>/g, " ")
    // Processa termos em grego e hebraico antes de qualquer outra limpeza
    .replace(/([\s\S]+)/, processarTermosEstrangeiros)
    // Remove marcações markdown: **negrito**, *itálico*, __sublinhado__, ~~tachado~~
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    // Remove cabeçalhos markdown (# Título)
    .replace(/^#{1,6}\s+/gm, "")
    // Remove links markdown [texto](url) → texto
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    // Remove blocos de código
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    // Normaliza múltiplas quebras de linha (≥2) → ponto + espaço para pausa natural
    .replace(/\n{2,}/g, ". ")
    // Normaliza quebras de linha simples → espaço
    .replace(/\n/g, " ")
    // Colapsa múltiplos espaços
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Montagem do texto para TTS
// ---------------------------------------------------------------------------

function montarTextoTTS(
  titulo: string,
  conteudo: string,
  referencia?: string
): string {
  const partes: string[] = [titulo.trim()];
  if (referencia?.trim()) partes.push(referencia.trim());
  partes.push(conteudo);
  return partes.join(". ");
}

// ---------------------------------------------------------------------------
// Chunking
// ---------------------------------------------------------------------------

const TTS_MAX_CHARS = 4096;

/**
 * Divide o texto em chunks respeitando o limite de caracteres,
 * tentando quebrar nos limites de frases para preservar naturalidade.
 * Nunca trunca silenciosamente.
 */
function dividirEmChunks(texto: string, maxChars = TTS_MAX_CHARS): string[] {
  if (texto.length <= maxChars) return [texto];

  const chunks: string[] = [];
  let restante = texto;

  while (restante.length > 0) {
    if (restante.length <= maxChars) {
      chunks.push(restante);
      break;
    }

    // Procura o último ponto final antes do limite
    const fatia = restante.slice(0, maxChars);
    const ultimoPonto = fatia.lastIndexOf(". ");

    const corte = ultimoPonto > maxChars * 0.5
      ? ultimoPonto + 2  // inclui o espaço após o ponto
      : maxChars;        // fallback: corte duro (sem ponto disponível)

    chunks.push(restante.slice(0, corte).trim());
    restante = restante.slice(corte).trim();
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Geração de áudio via OpenAI TTS
// ---------------------------------------------------------------------------

/**
 * Gera um buffer MP3 para cada chunk e retorna o array de buffers.
 * A concatenação simples é aceitável para staging.
 * ⚠️  Para produção com volumes maiores, migrar para FFmpeg
 *     a fim de evitar glitches de header entre chunks.
 *     Esta implementação não cria dependência que impeça essa migração.
 */
async function gerarBuffersAudio(
  openai: OpenAI,
  chunks: string[]
): Promise<Buffer[]> {
  const buffers: Buffer[] = [];

  for (const chunk of chunks) {
    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: "onyx",
      input: chunk,
      response_format: "mp3",
    });

    const arrayBuffer = await response.arrayBuffer();
    buffers.push(Buffer.from(arrayBuffer));
  }

  return buffers;
}

// ---------------------------------------------------------------------------
// Handler principal
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  ensureAdminInitialized();

  const adminAuth = getAuth();
  const adminDb = getFirestore();
  const adminStorage = getStorage();

  // ── 1. Autenticação ──────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!idToken) {
    return NextResponse.json(
      { error: "Não autenticado." },
      { status: 401 }
    );
  }

  try {
    await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json(
      { error: "Token inválido ou expirado." },
      { status: 401 }
    );
  }

  // ── 2. Parse e validação do body ─────────────────────────────────────────
  let body: TTSRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const { postId, tipo, titulo, conteudo, referencia } = body;

  if (!postId || !tipo || !titulo || !conteudo) {
    return NextResponse.json(
      { error: "Campos obrigatórios ausentes: postId, tipo, titulo, conteudo." },
      { status: 400 }
    );
  }

  const tiposValidos = ["sermao", "estudo", "reflexao"];
  if (!tiposValidos.includes(tipo)) {
    return NextResponse.json(
      { error: `Tipo inválido. Valores aceitos: ${tiposValidos.join(", ")}.` },
      { status: 400 }
    );
  }

  // ── 3. Referência ao documento Firestore ─────────────────────────────────
  const postRef = adminDb.collection("posts").doc(postId);

  // ── 4. Verificar se audioUrl já existe e está pronto ─────────────────────
  const postSnap = await postRef.get();
  const postData = postSnap.data() ?? {};

  const audioStatus = postData.audioStatus as AudioStatus | undefined;
  const audioUrl = postData.audioUrl as string | undefined;

  if (audioUrl && audioStatus === "ready") {
    return NextResponse.json({ audioUrl });
  }

  // ── 5. Marcar como "generating" antes de iniciar (lock distribuído) ───────
  await postRef.set(
    { audioStatus: "generating" as AudioStatus },
    { merge: true }
  );

  // ── 6. Limpeza e montagem do texto ───────────────────────────────────────
  const conteudoLimpo = limparConteudo(conteudo);
  const textoTTS = montarTextoTTS(titulo, conteudoLimpo, referencia);

  // ── 7. Geração do áudio ──────────────────────────────────────────────────
  let audioFinal: Buffer;

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const chunks = dividirEmChunks(textoTTS);
    const buffers = await gerarBuffersAudio(openai, chunks);

    // Concatenação de buffers: aceitável para staging.
    // Não cria acoplamento que impeça futura migração para FFmpeg.
    audioFinal = Buffer.concat(buffers);
  } catch (err) {
    console.error("[TTS] Erro ao gerar áudio:", err);
    await postRef.set(
      {
        audioStatus: "error" as AudioStatus,
        audioUpdatedAt: Timestamp.now(),
      },
      { merge: true }
    );
    return NextResponse.json(
      { error: "Falha ao gerar áudio via TTS." },
      { status: 502 }
    );
  }

  // ── 8. Upload para Firebase Storage ──────────────────────────────────────
  let downloadURL: string;

  try {
    const bucket = adminStorage.bucket();
    const storagePath = `tts/posts/${postId}.mp3`;
    const file = bucket.file(storagePath);

    await file.save(audioFinal, {
      metadata: {
        contentType: "audio/mpeg",
        cacheControl: "public, max-age=31536000",
      },
    });

    // Gera URL pública com token
    const [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: "03-01-2500", // data longa — revisitar na Fase 10
    });

    downloadURL = signedUrl;
  } catch (err) {
    console.error("[TTS] Erro ao fazer upload para Storage:", err);
    await postRef.set(
      {
        audioStatus: "error" as AudioStatus,
        audioUpdatedAt: Timestamp.now(),
      },
      { merge: true }
    );
    return NextResponse.json(
      { error: "Falha ao salvar arquivo de áudio." },
      { status: 502 }
    );
  }

  // ── 9. Salvar URL e status no Firestore ───────────────────────────────────
  try {
    await postRef.set(
      {
        audioUrl: downloadURL,
        audioStatus: "ready" as AudioStatus,
        audioUpdatedAt: Timestamp.now(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error("[TTS] Erro ao salvar no Firestore:", err);
    // Áudio foi gerado e salvo no Storage — retornamos a URL mesmo assim,
    // mas logamos o erro para investigação posterior.
    return NextResponse.json(
      { error: "Áudio gerado, mas falha ao salvar metadados." },
      { status: 207 }
    );
  }

  // ── 10. Resposta de sucesso ───────────────────────────────────────────────
  return NextResponse.json({ audioUrl: downloadURL });
}