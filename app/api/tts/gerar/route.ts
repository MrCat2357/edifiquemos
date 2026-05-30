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
    initializeApp({
      credential: cert(serviceAccount),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
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
}

// ---------------------------------------------------------------------------
// Transliteração — Grego → Latino (padrão SBL simplificado)
// ---------------------------------------------------------------------------

function contemGrego(texto: string): boolean {
  return /[\u0370-\u03FF\u1F00-\u1FFF]/.test(texto);
}

function contemHebraico(texto: string): boolean {
  return /[\u0590-\u05FF]/.test(texto);
}

function transliterarGrego(palavra: string): string {
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

function transliterarHebraico(palavra: string): string {
  const mapa: Record<string, string> = {
    "א": "",
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
    "ע": "",
    "פ": "f", "ף": "f", "פּ": "p",
    "צ": "ts", "ץ": "ts",
    "ק": "q",
    "ר": "r",
    "ש": "sh", "שׁ": "sh", "שׂ": "s",
    "ת": "t",
    "\u05B0": "e",
    "\u05B1": "e",
    "\u05B2": "a",
    "\u05B3": "o",
    "\u05B4": "i",
    "\u05B5": "e",
    "\u05B6": "e",
    "\u05B7": "a",
    "\u05B8": "a",
    "\u05B9": "o",
    "\u05BA": "o",
    "\u05BB": "u",
    "\u05BC": "",
    "\u05C1": "",
    "\u05C2": "",
  };

  return palavra
    .split("")
    .map((c) => mapa[c] ?? c)
    .join("");
}

// ---------------------------------------------------------------------------
// Limpeza de conteúdo
// ---------------------------------------------------------------------------

function removerSecoesDesnecessarias(texto: string): string {
  return texto
    .replace(
      /\b(bibliografia|referências|referencias|notas de rodapé|notas de rodape|notas:)\b[\s\S]*/gi,
      ""
    )
    .trim();
}

function processarTermosEstrangeiros(texto: string): string {
  // Caso 1: grego/hebraico imediatamente seguido de transliteração entre parênteses
  texto = texto.replace(
    /([\u0370-\u03FF\u1F00-\u1FFF\u0590-\u05FF][\u0370-\u03FF\u1F00-\u1FFF\u0590-\u05FF\s]*?)\s*\(([^)]+)\)/g,
    (match, _estrangeiro, transliteracao) => {
      if (contemGrego(transliteracao) || contemHebraico(transliteracao)) {
        return match;
      }
      return transliteracao;
    }
  );

  // Caso 2: grego restante → transliteração automática
  texto = texto.replace(/[\u0370-\u03FF\u1F00-\u1FFF]+/g, (match) =>
    transliterarGrego(match)
  );

  // Caso 3: hebraico restante → transliteração automática
  texto = texto.replace(/[\u0590-\u05FF]+/g, (match) =>
    transliterarHebraico(match)
  );

  return texto;
}

// CORREÇÃO: chamadas diretas em vez de replace(/([\s\S]+)/, fn)
// que corrompida caracteres acentuados como ã, ç, õ
function limparConteudo(raw: string): string {
  let texto = raw.replace(/<[^>]+>/g, " ");
  texto = removerSecoesDesnecessarias(texto);
  texto = processarTermosEstrangeiros(texto);
  return texto
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Montagem do texto para TTS
// CORREÇÃO: estrutura diferente por tipo — reflexão usa fraseInstigadora e
// perguntaReflexiva em vez de igreja e data
// ---------------------------------------------------------------------------

function montarTextoTTS(
  titulo: string,
  conteudo: string,
  tipo: "sermao" | "estudo" | "reflexao",
  autorNome?: string,
  igreja?: string,
  data?: string,
  fraseInstigadora?: string,
  perguntaReflexiva?: string,
): string {
  if (tipo === "reflexao") {
    const partes: string[] = [titulo.trim()];
    if (autorNome?.trim()) partes.push(autorNome.trim());
    if (fraseInstigadora?.trim()) partes.push(fraseInstigadora.trim());
    partes.push(conteudo);
    if (perguntaReflexiva?.trim()) partes.push(perguntaReflexiva.trim());
    return partes.join(". ");
  }

  // sermao / estudo
  const partes: string[] = [titulo.trim()];
  if (autorNome?.trim()) partes.push(autorNome.trim());
  if (igreja?.trim()) partes.push(igreja.trim());
  if (data?.trim()) partes.push(data.trim());
  partes.push(conteudo);
  return partes.join(". ");
}

// ---------------------------------------------------------------------------
// Chunking
// ---------------------------------------------------------------------------

const TTS_MAX_CHARS = 4096;

function dividirEmChunks(texto: string, maxChars = TTS_MAX_CHARS): string[] {
  if (texto.length <= maxChars) return [texto];

  const chunks: string[] = [];
  let restante = texto;

  while (restante.length > 0) {
    if (restante.length <= maxChars) {
      chunks.push(restante);
      break;
    }

    const fatia = restante.slice(0, maxChars);
    const ultimoPonto = fatia.lastIndexOf(". ");

    const corte = ultimoPonto > maxChars * 0.5
      ? ultimoPonto + 2
      : maxChars;

    chunks.push(restante.slice(0, corte).trim());
    restante = restante.slice(corte).trim();
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Geração de áudio via OpenAI TTS
// ---------------------------------------------------------------------------

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
// Concatenação de MP3s — puro Node.js, sem binário nativo
// Funciona na Vercel (Linux) e em qualquer plataforma
// ---------------------------------------------------------------------------

/**
 * Remove o header ID3v2 do início de um buffer MP3, se presente.
 * ID3v2 começa com os magic bytes "ID3" (0x49 0x44 0x33).
 * O tamanho total do header está nos bytes 6–9 em syncsafe integer (7 bits/byte).
 */
function removerHeaderID3(buffer: Buffer): Buffer {
  if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
    const tamanho =
      ((buffer[6] & 0x7f) << 21) |
      ((buffer[7] & 0x7f) << 14) |
      ((buffer[8] & 0x7f) << 7) |
      (buffer[9] & 0x7f);
    // +10 para pular os 10 bytes do próprio header ID3v2
    return buffer.slice(10 + tamanho);
  }
  return buffer;
}

/**
 * Concatena múltiplos buffers MP3 corretamente:
 * - mantém o header ID3 do primeiro chunk (players usam ele para metadados)
 * - remove headers ID3 dos chunks seguintes (evita que o player pare no fim do 1º chunk)
 * - resultado é um MP3 válido com duração e conteúdo completos
 */
function concatenarMP3s(buffers: Buffer[]): Buffer {
  if (buffers.length === 1) return buffers[0];

  const partes: Buffer[] = [];

  for (let i = 0; i < buffers.length; i++) {
    if (i === 0) {
      partes.push(buffers[i]);
    } else {
      partes.push(removerHeaderID3(buffers[i]));
    }
  }

  return Buffer.concat(partes);
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

  const { postId, tipo, titulo } = body;

  if (!postId || !tipo || !titulo) {
    return NextResponse.json(
      { error: "Campos obrigatórios ausentes: postId, tipo, titulo." },
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

  // ── 4. Verificar cache e ler campos do Firestore ──────────────────────────
  const postSnap = await postRef.get();
  const postData = postSnap.data() ?? {};

  const audioStatus = postData.audioStatus as AudioStatus | undefined;
  const audioUrl = postData.audioUrl as string | undefined;

  if (audioUrl && audioStatus === "ready") {
    return NextResponse.json({ audioUrl });
  }

  const conteudo = postData.conteudo as string | undefined;
  if (!conteudo) {
    return NextResponse.json(
      { error: "Campo 'conteudo' não encontrado no post." },
      { status: 422 }
    );
  }

  // Campos opcionais lidos do Firestore
  const autorNome = postData.autorNome as string | undefined;
  const igreja = postData.igreja as string | undefined;
  const data = postData.data as string | undefined;
  const fraseInstigadora = postData.fraseInstigadora as string | undefined;
  const perguntaReflexiva = postData.perguntaReflexiva as string | undefined;

  // ── 5. Marcar como "generating" (lock distribuído) ────────────────────────
  await postRef.set(
    { audioStatus: "generating" as AudioStatus },
    { merge: true }
  );

  // ── 6. Limpeza e montagem do texto ───────────────────────────────────────
  const conteudoLimpo = limparConteudo(conteudo);
  const textoTTS = montarTextoTTS(
    titulo,
    conteudoLimpo,
    tipo,
    autorNome,
    igreja,
    data,
    fraseInstigadora,
    perguntaReflexiva,
  );

  // ── 7. Geração e concatenação do áudio ───────────────────────────────────
  let audioFinal: Buffer;

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const chunks = dividirEmChunks(textoTTS);
    const buffers = await gerarBuffersAudio(openai, chunks);
    audioFinal = concatenarMP3s(buffers);
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
        // Cache-control curto: permite que CDNs e browsers revalidem após
        // regeneração de voz. A URL versionada (parâmetro v=) é a proteção
        // real contra cache obsoleto — este header é defesa adicional.
        cacheControl: "public, max-age=3600",
      },
    });

    const [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: "03-01-2500",
    });

    // Cache-buster: adiciona timestamp à URL para garantir que o navegador
    // não sirva versão antiga após regeneração de voz pelo autor.
    // A URL gravada no Firestore muda a cada geração — visitantes que
    // apertam Ouvir recebem sempre a URL já gravada (sem gerar novamente).
    downloadURL = `${signedUrl}&v=${Date.now()}`;
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
    return NextResponse.json(
      { error: "Áudio gerado, mas falha ao salvar metadados." },
      { status: 207 }
    );
  }

  // ── 10. Resposta de sucesso ───────────────────────────────────────────────
  return NextResponse.json({ audioUrl: downloadURL });
}