#!/usr/bin/env node
/**
 * scripts/generate-all-audio.cjs
 *
 * Uso:
 *   # Staging (.env.local)
 *   node scripts/generate-all-audio.cjs
 *
 *   # Produção (.env.production.local)
 *   NODE_ENV=production node scripts/generate-all-audio.cjs
 */

"use strict";

const path   = require("path");
const fs     = require("fs");
const dotenv = require("dotenv");

const envFile = process.env.NODE_ENV === "production"
  ? ".env.production.local"
  : ".env.local";

const envPath = path.resolve(process.cwd(), envFile);

if (!fs.existsSync(envPath)) {
  console.error(`\n❌  Arquivo ${envFile} não encontrado em ${process.cwd()}\n`);
  process.exit(1);
}

dotenv.config({ path: envPath });
console.log(`\n✅  Ambiente carregado: ${envFile}\n`);

const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getFirestore, Timestamp }      = require("firebase-admin/firestore");
const { S3Client, PutObjectCommand }   = require("@aws-sdk/client-s3");
const OpenAI                           = require("openai").default;

function initAdmin() {
  if (getApps().length > 0) return getApps()[0];
  const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? "")
    .replace(/^"|"$/g, "")
    .replace(/\\n/g, "\n");
  return initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

function getS3() {
  return new S3Client({
    region:   "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

function limparConteudo(raw) {
  return raw
    .replace(/<[^>]+>/g, " ")
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

function montarTexto(titulo, conteudo, autorNome) {
  const partes = [titulo.trim()];
  if (autorNome && autorNome.trim()) partes.push(autorNome.trim());
  partes.push(conteudo);
  return partes.join(". ");
}

const TTS_MAX_CHARS = 4096;

function dividirEmChunks(texto) {
  if (texto.length <= TTS_MAX_CHARS) return [texto];
  const chunks = [];
  let restante = texto;
  while (restante.length > 0) {
    if (restante.length <= TTS_MAX_CHARS) { chunks.push(restante); break; }
    const fatia = restante.slice(0, TTS_MAX_CHARS);
    const corte = fatia.lastIndexOf(". ");
    const idx   = corte > TTS_MAX_CHARS * 0.5 ? corte + 2 : TTS_MAX_CHARS;
    chunks.push(restante.slice(0, idx).trim());
    restante = restante.slice(idx).trim();
  }
  return chunks;
}

function removerHeaderID3(buffer) {
  if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
    const tam =
      ((buffer[6] & 0x7f) << 21) | ((buffer[7] & 0x7f) << 14) |
      ((buffer[8] & 0x7f) << 7)  |  (buffer[9] & 0x7f);
    return buffer.slice(10 + tam);
  }
  return buffer;
}

function concatenarMP3s(buffers) {
  if (buffers.length === 1) return buffers[0];
  return Buffer.concat(buffers.map((b, i) => i === 0 ? b : removerHeaderID3(b)));
}

async function gerarChunkComRetry(openai, chunk, tentativa = 1) {
  try {
    const res = await openai.audio.speech.create({
      model:           "tts-1",
      voice:           "onyx",
      input:           chunk,
      response_format: "mp3",
    });
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    if (tentativa < 3) {
      const espera = tentativa * 3000;
      console.log(`         ⏳  Retry ${tentativa}/2 em ${espera / 1000}s...`);
      await new Promise((r) => setTimeout(r, espera));
      return gerarChunkComRetry(openai, chunk, tentativa + 1);
    }
    throw err;
  }
}

async function gerarAudio(openai, texto) {
  const chunks  = dividirEmChunks(texto);
  const buffers = [];
  for (const chunk of chunks) {
    buffers.push(await gerarChunkComRetry(openai, chunk));
  }
  return concatenarMP3s(buffers);
}

async function main() {
  const required = [
    "FIREBASE_ADMIN_PROJECT_ID",
    "FIREBASE_ADMIN_CLIENT_EMAIL",
    "FIREBASE_ADMIN_PRIVATE_KEY",
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
    "R2_PUBLIC_URL",
    "OPENAI_API_KEY",
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error("❌  Variáveis de ambiente ausentes:", missing.join(", "));
    process.exit(1);
  }

  initAdmin();
  const db     = getFirestore();
  const s3     = getS3();
  const openai = new OpenAI({
    apiKey:     process.env.OPENAI_API_KEY,
    timeout:    60000,
    maxRetries: 0,
  });

  console.log("🔍  Buscando posts sem áudio...\n");

  const snapshot  = await db.collection("posts").get();
  const pendentes = [];

  for (const doc of snapshot.docs) {
    const d          = doc.data();
    const status     = d.audioStatus ?? "none";
    const errorCount = d.audioErrorCount ?? 0;

    if (status === "ready")                    continue;
    if (status === "generating")               continue;
    if (status === "error" && errorCount >= 3) continue;
    if (!d.conteudo || !d.titulo)              continue;

    pendentes.push({
      id:              doc.id,
      tipo:            d.tipo ?? "sermao",
      titulo:          d.titulo,
      conteudo:        d.conteudo,
      autorNome:       d.autorNome,
      audioStatus:     status,
      audioErrorCount: errorCount,
    });
  }

  if (pendentes.length === 0) {
    console.log("✅  Nenhum post pendente. Todos já têm áudio gerado.\n");
    return;
  }

  console.log(`📋  ${pendentes.length} post(s) para processar:\n`);
  pendentes.forEach((p, i) => {
    console.log(`  ${i + 1}. [${p.audioStatus}] ${p.titulo.slice(0, 60)}`);
  });
  console.log();

  let ok = 0, falhou = 0;

  for (let i = 0; i < pendentes.length; i++) {
    const post    = pendentes[i];
    const postRef = db.collection("posts").doc(post.id);
    const pre     = `[${i + 1}/${pendentes.length}]`;

    console.log(`${pre} ▶  ${post.titulo.slice(0, 55)}`);

    await postRef.set(
      { audioStatus: "generating", audioUpdatedAt: Timestamp.now() },
      { merge: true }
    );

    try {
      const conteudoLimpo = limparConteudo(post.conteudo);
      const texto         = montarTexto(post.titulo, conteudoLimpo, post.autorNome);

      console.log(`         chars : ${texto.length}`);

      const audioBuffer = await gerarAudio(openai, texto);

      const key         = `tts/posts/${post.id}.mp3`;
      const downloadURL = `${process.env.R2_PUBLIC_URL}/${key}`;

      await s3.send(new PutObjectCommand({
        Bucket:      process.env.R2_BUCKET_NAME,
        Key:         key,
        Body:        audioBuffer,
        ContentType: "audio/mpeg",
      }));

      await postRef.set(
        {
          audioUrl:        downloadURL,
          audioStatus:     "ready",
          audioUpdatedAt:  Timestamp.now(),
          audioErrorCount: 0,
          audioVoiceId:    null,
        },
        { merge: true }
      );

      console.log(`         ✅  OK\n`);
      ok++;

      if (i < pendentes.length - 1) {
        await new Promise((r) => setTimeout(r, 1500));
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`         ❌  ${msg}\n`);

      await postRef.set(
        {
          audioStatus:     "error",
          audioUpdatedAt:  Timestamp.now(),
          audioErrorCount: (post.audioErrorCount ?? 0) + 1,
        },
        { merge: true }
      );

      falhou++;
    }
  }

  console.log("─".repeat(50));
  console.log(`✅  Gerados : ${ok}`);
  if (falhou > 0) {
    console.log(`❌  Erros   : ${falhou}  (rode novamente; posts com 3+ erros são ignorados)`);
  }
  console.log();
}

main().catch((err) => {
  console.error("\n💥  Erro fatal:", err);
  process.exit(1);
});