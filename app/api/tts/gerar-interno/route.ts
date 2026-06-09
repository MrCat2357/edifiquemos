/**
 * app/api/tts/gerar-interno/route.ts
 *
 * Fase 10 — Geração de áudio disparada internamente pelo cron
 * (regenerar-pendentes), sem depender de Firebase ID Token.
 *
 * Autenticação: header "x-internal-secret" comparado com env INTERNAL_API_SECRET.
 * Nunca exposta ao público — chamada apenas por /api/tts/regenerar-pendentes.
 *
 * Lógica de geração idêntica à de /api/tts/gerar (POST), incluindo:
 *   - Busca voiceId do autor (voiceStatus === "ready")
 *   - Trata "stale" como "none" (força regeneração)
 *   - Guard contra duplicação se já está "generating"
 *   - Gera via ElevenLabs ou fallback OpenAI
 *   - Upload para R2 + purga Cloudflare
 *   - Salva audioUrl, audioStatus, audioVoiceId, audioContentHash no Firestore
 *   - Log de custo fire-and-forget em tts_logs
 *
 * NÃO altera nenhum outro arquivo existente.
 * NÃO duplica funções de lib/tts/ — importa das mesmas fontes.
 */

import { NextRequest, NextResponse } from "next/server";
import { getApps, getApp, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import OpenAI from "openai";
import { computarHashConteudo } from "@/lib/tts/hash";
import { purgarCacheCloudflare } from "@/lib/tts/cloudflare";

// ---------------------------------------------------------------------------
// Firebase Admin — instância nomeada "gerar-interno-admin"
// Nome único para não colidir com "tts-admin", "cron-admin" etc.
// ---------------------------------------------------------------------------

const ADMIN_APP_NAME = "gerar-interno-admin";

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
// S3Client — endpoint R2 da Cloudflare
// ---------------------------------------------------------------------------

function getS3Client(): S3Client {
  return new S3Client({
    region: "auto",
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

type AudioStatus = "none" | "generating" | "ready" | "error" | "stale";
type VoiceStatus = "none" | "processing" | "ready" | "error";

interface RequestBody {
  postId: string;
  tipo:   "sermao" | "estudo" | "reflexao";
  titulo: string;
}

// ---------------------------------------------------------------------------
// Constante de timeout para auto-recovery (10 minutos em ms)
// ---------------------------------------------------------------------------

const STUCK_GENERATING_TIMEOUT_MS = 10 * 60 * 1000;

// ---------------------------------------------------------------------------
// Geração via ElevenLabs
// ---------------------------------------------------------------------------

const ELEVENLABS_MAX_CHARS = 4500;

async function gerarBufferElevenLabs(voiceId: string, texto: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY não configurada.");

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key":   apiKey,
        "Content-Type": "application/json",
        Accept:         "audio/mpeg",
      },
      body: JSON.stringify({
        text:     texto,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability:        0.5,
          similarity_boost: 0.75,
          style:            0.0,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`ElevenLabs TTS ${res.status}: ${errBody}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

async function gerarBuffersElevenLabs(voiceId: string, chunks: string[]): Promise<Buffer[]> {
  const buffers: Buffer[] = [];
  for (const chunk of chunks) {
    buffers.push(await gerarBufferElevenLabs(voiceId, chunk));
  }
  return buffers;
}

// ---------------------------------------------------------------------------
// Geração via OpenAI TTS (voz padrão)
// ---------------------------------------------------------------------------

const TTS_MAX_CHARS = 4096;

async function gerarBuffersOpenAI(openai: OpenAI, chunks: string[]): Promise<Buffer[]> {
  const buffers: Buffer[] = [];
  for (const chunk of chunks) {
    const response = await openai.audio.speech.create({
      model: "tts-1", voice: "onyx", input: chunk, response_format: "mp3",
    });
    buffers.push(Buffer.from(await response.arrayBuffer()));
  }
  return buffers;
}

// ---------------------------------------------------------------------------
// Helpers de áudio
// ---------------------------------------------------------------------------

function dividirEmChunks(texto: string, maxChars = TTS_MAX_CHARS): string[] {
  if (texto.length <= maxChars) return [texto];
  const chunks: string[] = [];
  let restante = texto;
  while (restante.length > 0) {
    if (restante.length <= maxChars) { chunks.push(restante); break; }
    const fatia       = restante.slice(0, maxChars);
    const ultimoPonto = fatia.lastIndexOf(". ");
    const corte       = ultimoPonto > maxChars * 0.5 ? ultimoPonto + 2 : maxChars;
    chunks.push(restante.slice(0, corte).trim());
    restante = restante.slice(corte).trim();
  }
  return chunks;
}

function removerHeaderID3(buffer: Buffer): Buffer {
  if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
    const tamanho =
      ((buffer[6] & 0x7f) << 21) | ((buffer[7] & 0x7f) << 14) |
      ((buffer[8] & 0x7f) << 7)  |  (buffer[9] & 0x7f);
    return buffer.slice(10 + tamanho);
  }
  return buffer;
}

function concatenarMP3s(buffers: Buffer[]): Buffer {
  if (buffers.length === 1) return buffers[0];
  return Buffer.concat(buffers.map((b, i) => i === 0 ? b : removerHeaderID3(b)));
}

// ---------------------------------------------------------------------------
// Limpeza de conteúdo — espelho fiel do gerar/route.ts
// (mantida aqui para que gerar-interno seja autossuficiente e não crie
//  dependência circular; lib/tts/hash e lib/tts/cloudflare são importados
//  normalmente pois são utilitários puros sem estado)
// ---------------------------------------------------------------------------

function contemGrego(texto: string): boolean {
  return /[\u0370-\u03FF\u1F00-\u1FFF]/.test(texto);
}

function contemHebraico(texto: string): boolean {
  return /[\u0590-\u05FF]/.test(texto);
}

function transliterarGrego(palavra: string): string {
  const mapa: Record<string, string> = {
    "α": "a", "ά": "a", "ὰ": "a", "ᾶ": "a", "ἀ": "a", "ἁ": "a",
    "ἂ": "a", "ἃ": "a", "ἄ": "a", "ἅ": "a", "ἆ": "a", "ἇ": "a",
    "ᾀ": "a", "ᾁ": "a", "ᾂ": "a", "ᾃ": "a", "ᾄ": "a", "ᾅ": "a",
    "ᾆ": "a", "ᾇ": "a", "ᾲ": "a", "ᾳ": "a", "ᾴ": "a", "ᾷ": "a",
    "Α": "A", "Ά": "A", "Ὰ": "A", "Ἀ": "A", "Ἁ": "A", "Ἂ": "A",
    "Ἃ": "A", "Ἄ": "A", "Ἅ": "A", "Ἆ": "A", "Ἇ": "A",
    "β": "b", "Β": "B", "γ": "g", "Γ": "G", "δ": "d", "Δ": "D",
    "ε": "e", "έ": "e", "ὲ": "e", "ἐ": "e", "ἑ": "e", "ἒ": "e",
    "ἓ": "e", "ἔ": "e", "ἕ": "e",
    "Ε": "E", "Έ": "E", "Ὲ": "E", "Ἐ": "E", "Ἑ": "E", "Ἒ": "E",
    "Ἓ": "E", "Ἔ": "E", "Ἕ": "E",
    "ζ": "z", "Ζ": "Z",
    "η": "ē", "ή": "ē", "ὴ": "ē", "ῆ": "ē", "ἠ": "ē", "ἡ": "ē",
    "ἢ": "ē", "ἣ": "ē", "ἤ": "ē", "ἥ": "ē", "ἦ": "ē", "ἧ": "ē",
    "ῂ": "ē", "ῃ": "ē", "ῄ": "ē", "ῇ": "ē",
    "Η": "Ē", "Ή": "Ē", "Ὴ": "Ē", "Ἠ": "Ē", "Ἡ": "Ē", "Ἢ": "Ē",
    "Ἣ": "Ē", "Ἤ": "Ē", "Ἥ": "Ē", "Ἦ": "Ē", "Ἧ": "Ē",
    "θ": "th", "Θ": "Th",
    "ι": "i", "ί": "i", "ὶ": "i", "ῖ": "i", "ἰ": "i", "ἱ": "i",
    "ἲ": "i", "ἳ": "i", "ἴ": "i", "ἵ": "i", "ἶ": "i", "ἷ": "i",
    "ϊ": "i", "ΐ": "i",
    "Ι": "I", "Ί": "I", "Ὶ": "I", "Ἰ": "I", "Ἱ": "I", "Ἲ": "I",
    "Ἳ": "I", "Ἴ": "I", "Ἵ": "I", "Ἶ": "I", "Ἷ": "I",
    "κ": "k", "Κ": "K", "λ": "l", "Λ": "L", "μ": "m", "Μ": "M",
    "ν": "n", "Ν": "N", "ξ": "x", "Ξ": "X",
    "ο": "o", "ό": "o", "ὸ": "o", "ὀ": "o", "ὁ": "o", "ὂ": "o",
    "ὃ": "o", "ὄ": "o", "ὅ": "o",
    "Ο": "O", "Ό": "O", "Ὸ": "O", "Ὀ": "O", "Ὁ": "O", "Ὂ": "O",
    "Ὃ": "O", "Ὄ": "O", "Ὅ": "O",
    "π": "p", "Π": "P",
    "ρ": "r", "ῥ": "rh", "ῤ": "r", "Ρ": "R", "Ῥ": "Rh",
    "σ": "s", "ς": "s", "Σ": "S", "τ": "t", "Τ": "T",
    "υ": "y", "ύ": "y", "ὺ": "y", "ῦ": "y", "ὐ": "y", "ὑ": "y",
    "ὒ": "y", "ὓ": "y", "ὔ": "y", "ὕ": "y", "ὖ": "y", "ὗ": "y",
    "ϋ": "y", "ΰ": "y",
    "Υ": "Y", "Ύ": "Y", "Ὺ": "Y", "Ὑ": "Y", "Ὓ": "Y", "Ὕ": "Y", "Ὗ": "Y",
    "φ": "ph", "Φ": "Ph", "χ": "ch", "Χ": "Ch", "ψ": "ps", "Ψ": "Ps",
    "ω": "ō", "ώ": "ō", "ὼ": "ō", "ῶ": "ō", "ὠ": "ō", "ὡ": "ō",
    "ὢ": "ō", "ὣ": "ō", "ὤ": "ō", "ὥ": "ō", "ὦ": "ō", "ὧ": "ō",
    "ῲ": "ō", "ῳ": "ō", "ῴ": "ō", "ῷ": "ō",
    "Ω": "Ō", "Ώ": "Ō", "Ὼ": "Ō", "Ὠ": "Ō", "Ὡ": "Ō", "Ὢ": "Ō",
    "Ὣ": "Ō", "Ὤ": "Ō", "Ὥ": "Ō", "Ὦ": "Ō", "Ὧ": "Ō",
  };
  return palavra.split("").map((c) => mapa[c] ?? c).join("");
}

function transliterarHebraico(palavra: string): string {
  const mapa: Record<string, string> = {
    "א": "", "בּ": "b", "ב": "v", "ג": "g", "ד": "d", "ה": "h",
    "ו": "v", "ז": "z", "ח": "kh", "ט": "t", "י": "y",
    "כ": "kh", "ך": "kh", "כּ": "k", "ל": "l",
    "מ": "m", "ם": "m", "נ": "n", "ן": "n", "ס": "s", "ע": "",
    "פ": "f", "ף": "f", "פּ": "p", "צ": "ts", "ץ": "ts",
    "ק": "q", "ר": "r", "ש": "sh", "שׁ": "sh", "שׂ": "s", "ת": "t",
    "\u05B0": "e", "\u05B1": "e", "\u05B2": "a", "\u05B3": "o",
    "\u05B4": "i", "\u05B5": "e", "\u05B6": "e", "\u05B7": "a",
    "\u05B8": "a", "\u05B9": "o", "\u05BA": "o", "\u05BB": "u",
    "\u05BC": "", "\u05C1": "", "\u05C2": "",
  };
  return palavra.split("").map((c) => mapa[c] ?? c).join("");
}

function removerSecoesDesnecessarias(texto: string): string {
  return texto
    .replace(
      /\b(bibliografia|referências|referencias|notas de rodapé|notas de rodape|notas:)\b[\s\S]*/gi,
      ""
    )
    .trim();
}

function processarTermosEstrangeiros(texto: string): string {
  texto = texto.replace(
    /([\u0370-\u03FF\u1F00-\u1FFF\u0590-\u05FF][\u0370-\u03FF\u1F00-\u1FFF\u0590-\u05FF\s]*?)\s*\(([^)]+)\)/g,
    (match, _estrangeiro, transliteracao) => {
      if (contemGrego(transliteracao) || contemHebraico(transliteracao)) return match;
      return transliteracao;
    }
  );
  texto = texto.replace(/[\u0370-\u03FF\u1F00-\u1FFF]+/g, (m) => transliterarGrego(m));
  texto = texto.replace(/[\u0590-\u05FF]+/g,               (m) => transliterarHebraico(m));
  return texto;
}

const UNIDADES = [
  "", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
  "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis",
  "dezessete", "dezoito", "dezenove",
];
const DEZENAS  = ["", "", "vinte", "trinta", "quarenta", "cinquenta",
                  "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = ["", "cem", "duzentos", "trezentos", "quatrocentos", "quinhentos",
                  "seiscentos", "setecentos", "oitocentos", "novecentos"];

function inteiroExtenso(n: number): string {
  if (n <= 0 || !Number.isInteger(n)) return String(n);
  if (n < 20)   return UNIDADES[n];
  if (n < 100) {
    const d = Math.floor(n / 10), u = n % 10;
    return u === 0 ? DEZENAS[d] : `${DEZENAS[d]} e ${UNIDADES[u]}`;
  }
  if (n < 1000) {
    const c = Math.floor(n / 100), resto = n % 100;
    if (resto === 0) return CENTENAS[c];
    return `${c === 1 ? "cento" : CENTENAS[c]} e ${inteiroExtenso(resto)}`;
  }
  return String(n);
}

const ORDINAIS_MASC: Record<number, string> = {
  1:"primeiro",2:"segundo",3:"terceiro",4:"quarto",5:"quinto",
  6:"sexto",7:"sétimo",8:"oitavo",9:"nono",10:"décimo",
  11:"décimo primeiro",12:"décimo segundo",13:"décimo terceiro",
  14:"décimo quarto",15:"décimo quinto",16:"décimo sexto",
  17:"décimo sétimo",18:"décimo oitavo",19:"décimo nono",
  20:"vigésimo",30:"trigésimo",40:"quadragésimo",
  50:"quinquagésimo",60:"sexagésimo",70:"septuagésimo",
  80:"octagésimo",90:"nonagésimo",100:"centésimo",
};
const ORDINAIS_FEM: Record<number, string> = {
  1:"primeira",2:"segunda",3:"terceira",4:"quarta",5:"quinta",
  6:"sexta",7:"sétima",8:"oitava",9:"nona",10:"décima",
  11:"décima primeira",12:"décima segunda",13:"décima terceira",
  14:"décima quarta",15:"décima quinta",16:"décima sexta",
  17:"décima sétima",18:"décima oitava",19:"décima nona",
  20:"vigésima",30:"trigésima",40:"quadragésima",
  50:"quinquagésima",60:"sexagésima",70:"septuagésima",
  80:"octagésima",90:"nonagésima",100:"centésima",
};

function ordinalExtenso(n: number, feminino: boolean): string {
  const tabela = feminino ? ORDINAIS_FEM : ORDINAIS_MASC;
  if (tabela[n]) return tabela[n];
  const dezena = Math.floor(n / 10) * 10, unidade = n % 10;
  if (unidade === 0) return tabela[dezena] ?? String(n);
  const base = tabela[dezena] ?? inteiroExtenso(dezena);
  const uni  = (feminino ? ORDINAIS_FEM : ORDINAIS_MASC)[unidade] ?? inteiroExtenso(unidade);
  return `${base} ${uni}`;
}

function converterOrdinaisEPorcentagens(texto: string): string {
  texto = texto.replace(/(\d+(?:[.,]\d+)?)\s*%/g, (_m, num) => {
    const partes = num.replace(",", ".").split(".");
    const inteiro = parseInt(partes[0], 10);
    const temDecimal = partes.length > 1 && parseInt(partes[1], 10) !== 0;
    if (temDecimal) {
      const dec = parseInt(partes[1].replace(/0+$/, ""), 10);
      return `${inteiroExtenso(inteiro)} vírgula ${inteiroExtenso(dec)} por cento`;
    }
    return `${inteiroExtenso(inteiro)} por cento`;
  });
  texto = texto.replace(/(\d+)\s*°\s*([CF])\b/gi, (_m, num, escala) =>
    `${inteiroExtenso(parseInt(num, 10))} graus ${escala.toUpperCase() === "C" ? "Celsius" : "Fahrenheit"}`
  );
  texto = texto.replace(/(\d+)\s*[º°]/g, (_m, num) => ordinalExtenso(parseInt(num, 10), false));
  texto = texto.replace(/(\d+)\s*ª/g,    (_m, num) => ordinalExtenso(parseInt(num, 10), true));
  return texto;
}

function limparConteudo(raw: string): string {
  let texto = raw.replace(/<[^>]+>/g, " ");
  texto = removerSecoesDesnecessarias(texto);
  texto = processarTermosEstrangeiros(texto);
  texto = converterOrdinaisEPorcentagens(texto);
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

function montarTextoTTS(
  titulo:             string,
  conteudo:           string,
  tipo:               "sermao" | "estudo" | "reflexao",
  autorNome?:         string,
  igreja?:            string,
  data?:              string,
  fraseInstigadora?:  string,
  perguntaReflexiva?: string,
): string {
  if (tipo === "reflexao") {
    const partes: string[] = [titulo.trim()];
    if (autorNome?.trim())         partes.push(autorNome.trim());
    if (fraseInstigadora?.trim())  partes.push(fraseInstigadora.trim());
    partes.push(conteudo);
    if (perguntaReflexiva?.trim()) partes.push(perguntaReflexiva.trim());
    return partes.join(". ");
  }
  const partes: string[] = [titulo.trim()];
  if (autorNome?.trim()) partes.push(autorNome.trim());
  if (igreja?.trim())    partes.push(igreja.trim());
  if (data?.trim())      partes.push(data.trim());
  partes.push(conteudo);
  return partes.join(". ");
}

// ---------------------------------------------------------------------------
// POST /api/tts/gerar-interno
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // ── 1. Autenticação por secret header ─────────────────────────────────────
  const internalSecret = process.env.INTERNAL_API_SECRET;

  if (!internalSecret) {
    console.error("[GerarInterno] INTERNAL_API_SECRET não definido.");
    return NextResponse.json({ error: "Configuração ausente." }, { status: 500 });
  }

  const headerSecret = req.headers.get("x-internal-secret");

  if (headerSecret !== internalSecret) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  // ── 2. Parse e validação do body ──────────────────────────────────────────
  let body: RequestBody;
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

  if (!["sermao", "estudo", "reflexao"].includes(tipo)) {
    return NextResponse.json(
      { error: "Tipo inválido. Valores aceitos: sermao, estudo, reflexao." },
      { status: 400 }
    );
  }

  if (
    !process.env.R2_ACCOUNT_ID    || !process.env.R2_ACCESS_KEY_ID ||
    !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_BUCKET_NAME ||
    !process.env.R2_PUBLIC_URL
  ) {
    console.error("[GerarInterno] Variáveis de ambiente R2 ausentes.");
    return NextResponse.json({ error: "Configuração de storage ausente." }, { status: 500 });
  }

  // ── 3. Inicializar Firebase e buscar post ─────────────────────────────────
  ensureAdminInitialized();
  const adminDb = getFirestore(getAdminApp());

  const postRef  = adminDb.collection("posts").doc(postId);
  const postSnap = await postRef.get();

  if (!postSnap.exists) {
    return NextResponse.json({ error: "Post não encontrado." }, { status: 404 });
  }

  const postData = postSnap.data() ?? {};

  const audioStatus      = postData.audioStatus      as AudioStatus | undefined;
  const audioUrl         = postData.audioUrl         as string | undefined;
  const audioErrorCount  = (postData.audioErrorCount as number | undefined) ?? 0;
  const audioContentHash = postData.audioContentHash as string | undefined;
  const audioUpdatedAt   = postData.audioUpdatedAt   as import("firebase-admin/firestore").Timestamp | undefined;
  const conteudo         = postData.conteudo         as string | undefined;
  const autorId          = postData.autorId          as string | undefined;

  if (!conteudo) {
    return NextResponse.json({ error: "Campo 'conteudo' não encontrado." }, { status: 422 });
  }

  // ── 4. Buscar voiceId do autor ────────────────────────────────────────────
  let autorVoiceId: string | null = null;

  if (autorId) {
    try {
      const autorSnap = await adminDb.collection("users").doc(autorId).get();
      if (autorSnap.exists) {
        const autorData   = autorSnap.data() ?? {};
        const voiceStatus = autorData.voiceStatus as VoiceStatus | undefined;
        const voiceId     = autorData.voiceId     as string | undefined;

        if (voiceId && voiceStatus === "ready") {
          autorVoiceId = voiceId;
          console.log(`[GerarInterno] Usando voz clonada do autor ${autorId}: ${voiceId}`);
        } else {
          console.log(`[GerarInterno] Autor ${autorId} sem voz ativa (status: ${voiceStatus ?? "none"}), usando padrão.`);
        }
      }
    } catch (err) {
      console.warn("[GerarInterno] Falha ao buscar voiceId do autor (non-fatal):", err);
    }
  }

  // ── 5. Auto-recovery de posts travados em "generating" ────────────────────
  if (audioStatus === "generating" && audioUpdatedAt) {
    const idadeMs = Date.now() - audioUpdatedAt.toMillis();
    if (idadeMs > STUCK_GENERATING_TIMEOUT_MS) {
      console.log(`[GerarInterno] Post travado há ${Math.round(idadeMs / 60000)}min, resetando: ${postId}`);
      await postRef.set({ audioStatus: "none" as AudioStatus }, { merge: true });
    }
  }

  // ── 6. Rate limiting por erros consecutivos ───────────────────────────────
  if (audioStatus === "error" && audioErrorCount >= 3) {
    console.warn(`[GerarInterno] Rate limit atingido para post ${postId} (${audioErrorCount} erros)`);
    return NextResponse.json({ error: "Limite de tentativas atingido." }, { status: 429 });
  }

  // ── 7. Tratar "stale" como "none" ─────────────────────────────────────────
  const statusEfetivo: AudioStatus =
    audioStatus === "stale" ? "none" : (audioStatus ?? "none");

  // Guard contra duplicação
  if (statusEfetivo === "generating") {
    console.log(`[GerarInterno] Post ${postId} já em geração, ignorando.`);
    return NextResponse.json({ gerando: true });
  }

  // ── 8. Cache hit (só para "ready"; stale nunca chega aqui) ───────────────
  const hashAtual       = await computarHashConteudo(conteudo);
  const conteudoEditado = !audioContentHash || audioContentHash !== hashAtual;

  if (audioUrl && statusEfetivo === "ready" && !conteudoEditado) {
    // URL acessível → já está ok, nada a fazer
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 2000);
      const headRes = await fetch(audioUrl, { method: "HEAD", signal: controller.signal });
      if (headRes.ok) {
        console.log(`[GerarInterno] Cache hit, pulando: ${postId}`);
        return NextResponse.json({ audioUrl, cached: true });
      }
    } catch {
      // URL inacessível — prossegue para regenerar
    }
  }

  // ── 9. Marcar como "generating" ───────────────────────────────────────────
  await postRef.set(
    { audioStatus: "generating" as AudioStatus, audioUpdatedAt: Timestamp.now() },
    { merge: true }
  );

  // ── 10. Montar texto TTS ──────────────────────────────────────────────────
  const autorNome         = postData.autorNome         as string | undefined;
  const igreja            = postData.igreja            as string | undefined;
  const data              = postData.data              as string | undefined;
  const fraseInstigadora  = postData.fraseInstigadora  as string | undefined;
  const perguntaReflexiva = postData.perguntaReflexiva as string | undefined;

  const conteudoLimpo = limparConteudo(conteudo);
  const textoTTS = montarTextoTTS(
    titulo, conteudoLimpo, tipo,
    autorNome, igreja, data, fraseInstigadora, perguntaReflexiva,
  );

  // ── 11. Gerar áudio ───────────────────────────────────────────────────────
  let audioFinal: Buffer;
  let provedorUsado: "elevenlabs" | "openai";

  try {
    if (autorVoiceId && process.env.ELEVENLABS_API_KEY) {
      const chunks  = dividirEmChunks(textoTTS, ELEVENLABS_MAX_CHARS);
      const buffers = await gerarBuffersElevenLabs(autorVoiceId, chunks);
      audioFinal    = concatenarMP3s(buffers);
      provedorUsado = "elevenlabs";
      console.log(`[GerarInterno] Gerado via ElevenLabs (voz ${autorVoiceId}) para post ${postId}`);
    } else {
      const openai  = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const chunks  = dividirEmChunks(textoTTS);
      const buffers = await gerarBuffersOpenAI(openai, chunks);
      audioFinal    = concatenarMP3s(buffers);
      provedorUsado = "openai";
      console.log(`[GerarInterno] Gerado via OpenAI TTS (voz padrão) para post ${postId}`);
    }
  } catch (err) {
    console.error("[GerarInterno] Erro ao gerar áudio:", err);

    // Fallback ElevenLabs → OpenAI
    if (autorVoiceId && process.env.OPENAI_API_KEY) {
      console.warn("[GerarInterno] ElevenLabs falhou, tentando fallback para OpenAI...");
      try {
        const openai  = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const chunks  = dividirEmChunks(textoTTS);
        const buffers = await gerarBuffersOpenAI(openai, chunks);
        audioFinal    = concatenarMP3s(buffers);
        provedorUsado = "openai";
        autorVoiceId  = null; // fallback usou voz padrão
        console.log(`[GerarInterno] Fallback OpenAI bem-sucedido para post ${postId}`);
      } catch (fallbackErr) {
        console.error("[GerarInterno] Fallback OpenAI também falhou:", fallbackErr);
        await postRef.set(
          { audioStatus: "error" as AudioStatus, audioUpdatedAt: Timestamp.now(), audioErrorCount: audioErrorCount + 1 },
          { merge: true }
        );
        return NextResponse.json({ error: "Falha ao gerar áudio via TTS." }, { status: 502 });
      }
    } else {
      await postRef.set(
        { audioStatus: "error" as AudioStatus, audioUpdatedAt: Timestamp.now(), audioErrorCount: audioErrorCount + 1 },
        { merge: true }
      );
      return NextResponse.json({ error: "Falha ao gerar áudio via TTS." }, { status: 502 });
    }
  }

  // ── 12. Upload para R2 + purga Cloudflare ────────────────────────────────
  const downloadURL = `${process.env.R2_PUBLIC_URL}/tts/posts/${postId}.mp3`;

  try {
    await getS3Client().send(new PutObjectCommand({
      Bucket:      process.env.R2_BUCKET_NAME!,
      Key:         `tts/posts/${postId}.mp3`,
      Body:        audioFinal!,
      ContentType: "audio/mpeg",
    }));
    purgarCacheCloudflare([downloadURL]).catch((err) => {
      console.error("[GerarInterno] Erro ao purgar cache Cloudflare (non-fatal):", err);
    });
  } catch (err) {
    console.error("[GerarInterno] Erro ao fazer upload para R2:", err);
    await postRef.set(
      { audioStatus: "error" as AudioStatus, audioUpdatedAt: Timestamp.now(), audioErrorCount: audioErrorCount + 1 },
      { merge: true }
    );
    return NextResponse.json({ error: "Falha ao salvar arquivo de áudio." }, { status: 502 });
  }

  // ── 13. Salvar metadados no Firestore ─────────────────────────────────────
  try {
    await postRef.set(
      {
        audioUrl:         downloadURL,
        audioStatus:      "ready" as AudioStatus,
        audioUpdatedAt:   Timestamp.now(),
        audioContentHash: hashAtual,
        audioErrorCount:  0,
        audioVoiceId:     autorVoiceId, // null = voz padrão OpenAI
      },
      { merge: true }
    );
  } catch (err) {
    console.error("[GerarInterno] Erro ao salvar no Firestore:", err);
    return NextResponse.json(
      { error: "Áudio gerado, mas falha ao salvar metadados." },
      { status: 207 }
    );
  }

  // ── 14. Log de custo fire-and-forget ──────────────────────────────────────
  adminDb.collection("tts_logs").add({
    postId,
    tipo,
    charCount:        textoTTS.length,
    estimatedCostUSD: provedorUsado === "elevenlabs"
      ? textoTTS.length / 1000 * 0.30
      : textoTTS.length / 1_000_000 * 15,
    provedor:         provedorUsado,
    voiceId:          autorVoiceId ?? null,
    storage:          "r2",
    origem:           "cron", // distingue logs do cron vs. chamadas do usuário
    createdAt:        Timestamp.now(),
  }).catch(() => {});

  return NextResponse.json({ audioUrl: downloadURL });
}