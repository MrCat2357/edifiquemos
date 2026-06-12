/**
 * lib/tts/gerarAudio.ts
 *
 * Lógica de geração de áudio em background, compartilhada entre:
 *   - app/api/tts/gerar/route.ts     (chamado pelo player)
 *   - app/api/tts/invalidar/route.ts (chamado após edição)
 *
 * Exporta gerarAudioEmBackground(), que recebe apenas o postId + metadados
 * mínimos e busca todo o resto do Firestore.
 * Nunca lança exceção para o chamador — erros são gravados no Firestore.
 */

import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import OpenAI from "openai";
import { computarHashConteudo } from "@/lib/tts/hash";
import { purgarCacheCloudflare } from "@/lib/tts/cloudflare";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type AudioStatus = "none" | "generating" | "ready" | "error" | "stale";
type VoiceStatus = "none" | "processing" | "ready" | "error";

export interface GerarAudioParams {
  postId:   string;
  titulo:   string;
  tipo:     "sermao" | "estudo" | "reflexao";
  adminDb:  FirebaseFirestore.Firestore;
}

// ---------------------------------------------------------------------------
// S3Client
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
// Transliteração — Grego → Latino
// ---------------------------------------------------------------------------

function contemGrego(texto: string): boolean {
  return /[\u0370-\u03FF\u1F00-\u1FFF]/.test(texto);
}

function contemHebraico(texto: string): boolean {
  return /[\u0590-\u05FF]/.test(texto);
}

function transliterarGrego(palavra: string): string {
  const mapa: Record<string, string> = {
    "α":"a","ά":"a","ὰ":"a","ᾶ":"a","ἀ":"a","ἁ":"a","ἂ":"a","ἃ":"a","ἄ":"a","ἅ":"a","ἆ":"a","ἇ":"a",
    "ᾀ":"a","ᾁ":"a","ᾂ":"a","ᾃ":"a","ᾄ":"a","ᾅ":"a","ᾆ":"a","ᾇ":"a","ᾲ":"a","ᾳ":"a","ᾴ":"a","ᾷ":"a",
    "Α":"A","Ά":"A","Ὰ":"A","Ἀ":"A","Ἁ":"A","Ἂ":"A","Ἃ":"A","Ἄ":"A","Ἅ":"A","Ἆ":"A","Ἇ":"A",
    "β":"b","Β":"B","γ":"g","Γ":"G","δ":"d","Δ":"D",
    "ε":"e","έ":"e","ὲ":"e","ἐ":"e","ἑ":"e","ἒ":"e","ἓ":"e","ἔ":"e","ἕ":"e",
    "Ε":"E","Έ":"E","Ὲ":"E","Ἐ":"E","Ἑ":"E","Ἒ":"E","Ἓ":"E","Ἔ":"E","Ἕ":"E",
    "ζ":"z","Ζ":"Z",
    "η":"ē","ή":"ē","ὴ":"ē","ῆ":"ē","ἠ":"ē","ἡ":"ē","ἢ":"ē","ἣ":"ē","ἤ":"ē","ἥ":"ē","ἦ":"ē","ἧ":"ē",
    "ῂ":"ē","ῃ":"ē","ῄ":"ē","ῇ":"ē",
    "Η":"Ē","Ή":"Ē","Ὴ":"Ē","Ἠ":"Ē","Ἡ":"Ē","Ἢ":"Ē","Ἣ":"Ē","Ἤ":"Ē","Ἥ":"Ē","Ἦ":"Ē","Ἧ":"Ē",
    "θ":"th","Θ":"Th",
    "ι":"i","ί":"i","ὶ":"i","ῖ":"i","ἰ":"i","ἱ":"i","ἲ":"i","ἳ":"i","ἴ":"i","ἵ":"i","ἶ":"i","ἷ":"i",
    "ϊ":"i","ΐ":"i",
    "Ι":"I","Ί":"I","Ὶ":"I","Ἰ":"I","Ἱ":"I","Ἲ":"I","Ἳ":"I","Ἴ":"I","Ἵ":"I","Ἶ":"I","Ἷ":"I",
    "κ":"k","Κ":"K","λ":"l","Λ":"L","μ":"m","Μ":"M","ν":"n","Ν":"N","ξ":"x","Ξ":"X",
    "ο":"o","ό":"o","ὸ":"o","ὀ":"o","ὁ":"o","ὂ":"o","ὃ":"o","ὄ":"o","ὅ":"o",
    "Ο":"O","Ό":"O","Ὸ":"O","Ὀ":"O","Ὁ":"O","Ὂ":"O","Ὃ":"O","Ὄ":"O","Ὅ":"O",
    "π":"p","Π":"P",
    "ρ":"r","ῥ":"rh","ῤ":"r","Ρ":"R","Ῥ":"Rh",
    "σ":"s","ς":"s","Σ":"S","τ":"t","Τ":"T",
    "υ":"y","ύ":"y","ὺ":"y","ῦ":"y","ὐ":"y","ὑ":"y","ὒ":"y","ὓ":"y","ὔ":"y","ὕ":"y","ὖ":"y","ὗ":"y",
    "ϋ":"y","ΰ":"y",
    "Υ":"Y","Ύ":"Y","Ὺ":"Y","Ὑ":"Y","Ὓ":"Y","Ὕ":"Y","Ὗ":"Y",
    "φ":"ph","Φ":"Ph","χ":"ch","Χ":"Ch","ψ":"ps","Ψ":"Ps",
    "ω":"ō","ώ":"ō","ὼ":"ō","ῶ":"ō","ὠ":"ō","ὡ":"ō","ὢ":"ō","ὣ":"ō","ὤ":"ō","ὥ":"ō","ὦ":"ō","ὧ":"ō",
    "ῲ":"ō","ῳ":"ō","ῴ":"ō","ῷ":"ō",
    "Ω":"Ō","Ώ":"Ō","Ὼ":"Ō","Ὠ":"Ō","Ὡ":"Ō","Ὢ":"Ō","Ὣ":"Ō","Ὤ":"Ō","Ὥ":"Ō","Ὦ":"Ō","Ὧ":"Ō",
  };
  return palavra.split("").map((c) => mapa[c] ?? c).join("");
}

function transliterarHebraico(palavra: string): string {
  const mapa: Record<string, string> = {
    "א":"","בּ":"b","ב":"v","ג":"g","ד":"d","ה":"h","ו":"v","ז":"z","ח":"kh","ט":"t","י":"y",
    "כ":"kh","ך":"kh","כּ":"k","ל":"l","מ":"m","ם":"m","נ":"n","ן":"n","ס":"s","ע":"",
    "פ":"f","ף":"f","פּ":"p","צ":"ts","ץ":"ts","ק":"q","ר":"r","ש":"sh","שׁ":"sh","שׂ":"s","ת":"t",
    "\u05B0":"e","\u05B1":"e","\u05B2":"a","\u05B3":"o","\u05B4":"i","\u05B5":"e","\u05B6":"e",
    "\u05B7":"a","\u05B8":"a","\u05B9":"o","\u05BA":"o","\u05BB":"u","\u05BC":"","\u05C1":"","\u05C2":"",
  };
  return palavra.split("").map((c) => mapa[c] ?? c).join("");
}

// ---------------------------------------------------------------------------
// Limpeza de conteúdo
// ---------------------------------------------------------------------------

function removerSecoesDesnecessarias(texto: string): string {
  return texto
    .replace(/\b(bibliografia|referências|referencias|notas de rodapé|notas de rodape|notas:)\b[\s\S]*/gi, "")
    .trim();
}

function processarTermosEstrangeiros(texto: string): string {
  texto = texto.replace(
    /([\u0370-\u03FF\u1F00-\u1FFF\u0590-\u05FF][\u0370-\u03FF\u1F00-\u1FFF\u0590-\u05FF\s]*?)\s*\(([^)]+)\)/g,
    (_match, _estrangeiro, transliteracao) => {
      if (contemGrego(transliteracao) || contemHebraico(transliteracao)) return _match;
      return transliteracao;
    }
  );
  texto = texto.replace(/[\u0370-\u03FF\u1F00-\u1FFF]+/g, (m) => transliterarGrego(m));
  texto = texto.replace(/[\u0590-\u05FF]+/g,               (m) => transliterarHebraico(m));
  return texto;
}

const UNIDADES = [
  "","um","dois","três","quatro","cinco","seis","sete","oito","nove",
  "dez","onze","doze","treze","quatorze","quinze","dezesseis","dezessete","dezoito","dezenove",
];
const DEZENAS  = ["","","vinte","trinta","quarenta","cinquenta","sessenta","setenta","oitenta","noventa"];
const CENTENAS = ["","cem","duzentos","trezentos","quatrocentos","quinhentos","seiscentos","setecentos","oitocentos","novecentos"];

function inteiroExtenso(n: number): string {
  if (n <= 0 || !Number.isInteger(n)) return String(n);
  if (n < 20)  return UNIDADES[n];
  if (n < 100) {
    const d = Math.floor(n / 10), u = n % 10;
    return u === 0 ? DEZENAS[d] : `${DEZENAS[d]} e ${UNIDADES[u]}`;
  }
  if (n < 1000) {
    const c = Math.floor(n / 100), r = n % 100;
    if (r === 0) return CENTENAS[c];
    return `${c === 1 ? "cento" : CENTENAS[c]} e ${inteiroExtenso(r)}`;
  }
  return String(n);
}

const ORDINAIS_MASC: Record<number, string> = {
  1:"primeiro",2:"segundo",3:"terceiro",4:"quarto",5:"quinto",6:"sexto",7:"sétimo",8:"oitavo",9:"nono",
  10:"décimo",11:"décimo primeiro",12:"décimo segundo",13:"décimo terceiro",14:"décimo quarto",
  15:"décimo quinto",16:"décimo sexto",17:"décimo sétimo",18:"décimo oitavo",19:"décimo nono",
  20:"vigésimo",30:"trigésimo",40:"quadragésimo",50:"quinquagésimo",60:"sexagésimo",
  70:"septuagésimo",80:"octagésimo",90:"nonagésimo",100:"centésimo",
};
const ORDINAIS_FEM: Record<number, string> = {
  1:"primeira",2:"segunda",3:"terceira",4:"quarta",5:"quinta",6:"sexta",7:"sétima",8:"oitava",9:"nona",
  10:"décima",11:"décima primeira",12:"décima segunda",13:"décima terceira",14:"décima quarta",
  15:"décima quinta",16:"décima sexta",17:"décima sétima",18:"décima oitava",19:"décima nona",
  20:"vigésima",30:"trigésima",40:"quadragésima",50:"quinquagésima",60:"sexagésima",
  70:"septuagésima",80:"octagésima",90:"nonagésima",100:"centésima",
};

function ordinalExtenso(n: number, feminino: boolean): string {
  const t = feminino ? ORDINAIS_FEM : ORDINAIS_MASC;
  if (t[n]) return t[n];
  const dez = Math.floor(n / 10) * 10, uni = n % 10;
  if (uni === 0) return t[dez] ?? String(n);
  return `${t[dez] ?? inteiroExtenso(dez)} ${(feminino ? ORDINAIS_FEM : ORDINAIS_MASC)[uni] ?? inteiroExtenso(uni)}`;
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

export function limparConteudo(raw: string): string {
  let texto = raw.replace(/<[^>]+>/g, " ");
  texto = removerSecoesDesnecessarias(texto);
  texto = processarTermosEstrangeiros(texto);
  texto = converterOrdinaisEPorcentagens(texto);
  return texto
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g,    "$2")
    .replace(/~~(.*?)~~/g,        "$1")
    .replace(/^#{1,6}\s+/gm,      "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/```[\s\S]*?```/g,   "")
    .replace(/`[^`]*`/g,          "")
    .replace(/\n{2,}/g,           ". ")
    .replace(/\n/g,               " ")
    .replace(/\s{2,}/g,           " ")
    .trim();
}

export function montarTextoTTS(
  titulo:            string,
  conteudo:          string,
  tipo:              "sermao" | "estudo" | "reflexao",
  autorNome?:        string,
  igreja?:           string,
  data?:             string,
  fraseInstigadora?: string,
  perguntaReflexiva?:string,
): string {
  if (tipo === "reflexao") {
    const p: string[] = [titulo.trim()];
    if (autorNome?.trim())         p.push(autorNome.trim());
    if (fraseInstigadora?.trim())  p.push(fraseInstigadora.trim());
    p.push(conteudo);
    if (perguntaReflexiva?.trim()) p.push(perguntaReflexiva.trim());
    return p.join(". ");
  }
  const p: string[] = [titulo.trim()];
  if (autorNome?.trim()) p.push(autorNome.trim());
  if (igreja?.trim())    p.push(igreja.trim());
  if (data?.trim())      p.push(data.trim());
  p.push(conteudo);
  return p.join(". ");
}

const TTS_MAX_CHARS        = 4096;
const ELEVENLABS_MAX_CHARS = 4500;

export function dividirEmChunks(texto: string, maxChars = TTS_MAX_CHARS): string[] {
  if (texto.length <= maxChars) return [texto];
  const chunks: string[] = [];
  let restante = texto;
  while (restante.length > 0) {
    if (restante.length <= maxChars) { chunks.push(restante); break; }
    const fatia = restante.slice(0, maxChars);
    const corte = fatia.lastIndexOf(". ");
    const idx   = corte > maxChars * 0.5 ? corte + 2 : maxChars;
    chunks.push(restante.slice(0, idx).trim());
    restante = restante.slice(idx).trim();
  }
  return chunks;
}

// ---------------------------------------------------------------------------
// Geração ElevenLabs
// ---------------------------------------------------------------------------

async function gerarBufferElevenLabs(voiceId: string, texto: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY não configurada.");
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text: texto,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs TTS ${res.status}: ${await res.text().catch(() => "")}`);
  return Buffer.from(await res.arrayBuffer());
}

async function gerarBuffersElevenLabs(voiceId: string, chunks: string[]): Promise<Buffer[]> {
  const buffers: Buffer[] = [];
  for (const chunk of chunks) buffers.push(await gerarBufferElevenLabs(voiceId, chunk));
  return buffers;
}

// ---------------------------------------------------------------------------
// Geração OpenAI
// ---------------------------------------------------------------------------

async function gerarBuffersOpenAI(openai: OpenAI, chunks: string[]): Promise<Buffer[]> {
  const buffers: Buffer[] = [];
  for (const chunk of chunks) {
    const res = await openai.audio.speech.create({
      model: "tts-1", voice: "onyx", input: chunk, response_format: "mp3",
    });
    buffers.push(Buffer.from(await res.arrayBuffer()));
  }
  return buffers;
}

function removerHeaderID3(buffer: Buffer): Buffer {
  if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
    const tam =
      ((buffer[6] & 0x7f) << 21) | ((buffer[7] & 0x7f) << 14) |
      ((buffer[8] & 0x7f) << 7)  |  (buffer[9] & 0x7f);
    return buffer.slice(10 + tam);
  }
  return buffer;
}

function concatenarMP3s(buffers: Buffer[]): Buffer {
  if (buffers.length === 1) return buffers[0];
  return Buffer.concat(buffers.map((b, i) => (i === 0 ? b : removerHeaderID3(b))));
}

// ---------------------------------------------------------------------------
// gerarAudioEmBackground — exportado e chamado por invalidar + gerar
// ---------------------------------------------------------------------------

export async function gerarAudioEmBackground({
  postId,
  titulo,
  tipo,
  adminDb,
}: GerarAudioParams): Promise<void> {
  const postRef  = adminDb.collection("posts").doc(postId);
  const postSnap = await postRef.get();
  const postData = postSnap.data() ?? {};

  const audioErrorCount   = (postData.audioErrorCount as number | undefined) ?? 0;
  const conteudo          = postData.conteudo         as string | undefined;
  const autorId           = postData.autorId          as string | undefined;

  if (!conteudo) {
    console.warn(`[TTS BG] Post ${postId} sem conteúdo, abortando.`);
    await postRef.set({ audioStatus: "none" as AudioStatus }, { merge: true });
    return;
  }

  // ── Buscar voiceId do autor ───────────────────────────────────────────────
  let autorVoiceId: string | null = null;
  if (autorId) {
    try {
      const autorSnap = await adminDb.collection("users").doc(autorId).get();
      if (autorSnap.exists) {
        const d = autorSnap.data() ?? {};
        if (d.voiceId && (d.voiceStatus as VoiceStatus) === "ready") {
          autorVoiceId = d.voiceId as string;
          console.log(`[TTS BG] Voz clonada: ${autorId} → ${autorVoiceId}`);
        }
      }
    } catch (err) {
      console.warn("[TTS BG] Falha ao buscar voiceId (non-fatal):", err);
    }
  }

  // ── Montar texto TTS ──────────────────────────────────────────────────────
  const conteudoLimpo = limparConteudo(conteudo);
  const textoTTS = montarTextoTTS(
    titulo, conteudoLimpo, tipo,
    postData.autorNome        as string | undefined,
    postData.igreja           as string | undefined,
    postData.data             as string | undefined,
    postData.fraseInstigadora as string | undefined,
    postData.perguntaReflexiva as string | undefined,
  );

  // ── Gerar áudio ───────────────────────────────────────────────────────────
  let audioFinal: Buffer;
  let provedorUsado: "elevenlabs" | "openai";

  const gerarViaOpenAI = async (): Promise<Buffer> => {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return concatenarMP3s(await gerarBuffersOpenAI(openai, dividirEmChunks(textoTTS)));
  };

  try {
    if (autorVoiceId && process.env.ELEVENLABS_API_KEY) {
      audioFinal    = concatenarMP3s(await gerarBuffersElevenLabs(autorVoiceId, dividirEmChunks(textoTTS, ELEVENLABS_MAX_CHARS)));
      provedorUsado = "elevenlabs";
    } else {
      audioFinal    = await gerarViaOpenAI();
      provedorUsado = "openai";
    }
  } catch (err) {
    console.error("[TTS BG] Erro na geração:", err);
    // Fallback ElevenLabs → OpenAI
    if (autorVoiceId && process.env.OPENAI_API_KEY) {
      try {
        audioFinal    = await gerarViaOpenAI();
        provedorUsado = "openai";
        autorVoiceId  = null;
        console.log(`[TTS BG] Fallback OpenAI OK: ${postId}`);
      } catch (fe) {
        console.error("[TTS BG] Fallback também falhou:", fe);
        await postRef.set({ audioStatus: "error" as AudioStatus, audioUpdatedAt: Timestamp.now(), audioErrorCount: audioErrorCount + 1 }, { merge: true });
        return;
      }
    } else {
      await postRef.set({ audioStatus: "error" as AudioStatus, audioUpdatedAt: Timestamp.now(), audioErrorCount: audioErrorCount + 1 }, { merge: true });
      return;
    }
  }

  // ── Upload R2 ─────────────────────────────────────────────────────────────
  const downloadURL = `${process.env.R2_PUBLIC_URL}/tts/posts/${postId}.mp3`;
  try {
    await getS3Client().send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!, Key: `tts/posts/${postId}.mp3`,
      Body: audioFinal!, ContentType: "audio/mpeg",
    }));
    purgarCacheCloudflare([downloadURL]).catch((e) => console.error("[TTS BG] Purge CF non-fatal:", e));
  } catch (err) {
    console.error("[TTS BG] Upload R2 falhou:", err);
    await postRef.set({ audioStatus: "error" as AudioStatus, audioUpdatedAt: Timestamp.now(), audioErrorCount: audioErrorCount + 1 }, { merge: true });
    return;
  }

  // ── Salvar resultado ──────────────────────────────────────────────────────
  const hashAtual = await computarHashConteudo(conteudo);
  await postRef.set({
    audioUrl:         downloadURL,
    audioStatus:      "ready" as AudioStatus,
    audioUpdatedAt:   Timestamp.now(),
    audioContentHash: hashAtual,
    audioErrorCount:  0,
    audioVoiceId:     autorVoiceId,
  }, { merge: true });

  console.log(`[TTS BG] Gerado com sucesso: ${postId} (${provedorUsado!})`);

  // ── Log de custo ──────────────────────────────────────────────────────────
  adminDb.collection("tts_logs").add({
    postId, tipo,
    charCount:        textoTTS.length,
    estimatedCostUSD: provedorUsado === "elevenlabs" ? textoTTS.length / 1000 * 0.30 : textoTTS.length / 1_000_000 * 15,
    provedor:         provedorUsado,
    voiceId:          autorVoiceId ?? null,
    storage:          "r2",
    createdAt:        Timestamp.now(),
  }).catch(() => {});
}