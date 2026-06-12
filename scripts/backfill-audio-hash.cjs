#!/usr/bin/env node
/**
 * scripts/backfill-audio-hash.cjs
 *
 * Preenche audioContentHash nos posts que já têm audioStatus "ready"
 * mas foram gerados antes do sistema de hash SHA-256 existir.
 *
 * Por que isso é necessário:
 *   generate-all-audio.cjs não grava audioContentHash ao salvar o áudio.
 *   Sem esse campo, check-stale-audio.cjs marca o post como "stale" toda
 *   vez que roda (hash ausente = sempre divergente), criando um loop infinito
 *   de regeneração.
 *
 * O que este script faz:
 *   - Busca todos os posts com audioStatus "ready" e sem audioContentHash
 *   - Calcula o hash SHA-256 do conteudo atual
 *   - Grava audioContentHash no Firestore
 *   - NÃO regera áudio — assume que o áudio "ready" existente está correto
 *
 * Rode UMA VEZ após o deploy das mudanças de hash.
 * Depois disso, check-stale-audio + generate-all-audio cuidam do ciclo normal.
 *
 * Uso:
 *   # Staging (.env.local)
 *   node scripts/backfill-audio-hash.cjs
 *
 *   # Produção (.env.production.local)
 *   $env:NODE_ENV="production"; node scripts/backfill-audio-hash.cjs   (PowerShell)
 *   NODE_ENV=production node scripts/backfill-audio-hash.cjs            (bash)
 */

"use strict";

const path   = require("path");
const fs     = require("fs");
const dotenv = require("dotenv");

// ---------------------------------------------------------------------------
// Ambiente
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Firebase Admin
// ---------------------------------------------------------------------------

const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getFirestore, Timestamp }      = require("firebase-admin/firestore");

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

// ---------------------------------------------------------------------------
// Hash SHA-256 — mesma lógica de lib/tts/hash.ts e check-stale-audio.cjs
// ---------------------------------------------------------------------------

const { webcrypto } = require("crypto");

async function computarHashConteudo(conteudo) {
  const bytes      = new TextEncoder().encode(conteudo);
  const hashBuffer = await webcrypto.subtle.digest("SHA-256", bytes);
  const hashArray  = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const required = [
    "FIREBASE_ADMIN_PROJECT_ID",
    "FIREBASE_ADMIN_CLIENT_EMAIL",
    "FIREBASE_ADMIN_PRIVATE_KEY",
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error("❌  Variáveis de ambiente ausentes:", missing.join(", "));
    process.exit(1);
  }

  initAdmin();
  const db = getFirestore();

  console.log('🔍  Buscando posts com audioStatus "ready" sem audioContentHash...\n');

  const snapshot = await db
    .collection("posts")
    .where("audioStatus", "==", "ready")
    .get();

  // Filtra apenas os que não têm hash — os que já têm estão corretos
  const pendentes = snapshot.docs.filter((doc) => !doc.data().audioContentHash);

  const totalReady = snapshot.docs.length;

  if (pendentes.length === 0) {
    console.log(`✅  Todos os ${totalReady} post(s) "ready" já têm audioContentHash. Nada a fazer.\n`);
    return;
  }

  console.log(`📋  ${totalReady} post(s) com status "ready" encontrado(s).`);
  console.log(`⚠️   ${pendentes.length} sem audioContentHash — iniciando backfill...\n`);

  let ok       = 0;
  let pulados  = 0;
  let erros    = 0;

  for (let i = 0; i < pendentes.length; i++) {
    const docSnap = pendentes[i];
    const postId  = docSnap.id;
    const d       = docSnap.data();
    const titulo  = (d.titulo ?? "").slice(0, 55);
    const pre     = `[${i + 1}/${pendentes.length}]`;

    console.log(`${pre} ▶  ${titulo}`);

    if (!d.conteudo) {
      console.log(`         ⚠️   sem conteúdo — pulando\n`);
      pulados++;
      continue;
    }

    try {
      const hash = await computarHashConteudo(d.conteudo);
      await docSnap.ref.update({
        audioContentHash: hash,
        audioUpdatedAt:   Timestamp.now(),
      });
      console.log(`         ✅  hash gravado: ${hash.slice(0, 16)}...\n`);
      ok++;
    } catch (err) {
      console.error(`         ❌  Erro: ${err.message}\n`);
      erros++;
    }
  }

  // ── Relatório ─────────────────────────────────────────────────────────────
  console.log("─".repeat(55));
  console.log(`📊  Relatório`);
  console.log("─".repeat(55));
  console.log(`  Posts "ready" verificados : ${totalReady}`);
  console.log(`  Backfill realizado        : ${ok}`);
  if (pulados > 0) console.log(`  Pulados (sem conteúdo)    : ${pulados}`);
  if (erros > 0)   console.log(`  Erros                     : ${erros}`);
  console.log("─".repeat(55));

  if (ok > 0) {
    console.log(`\n✅  Backfill concluído. check-stale-audio.cjs não marcará`);
    console.log(`   mais esses posts como stale sem motivo real.\n`);
  }
  if (erros > 0) {
    console.log(`\n⚠️   ${erros} erro(s). Rode novamente para tentar os que falharam.\n`);
  }
}

main().catch((err) => {
  console.error("\n💥  Erro fatal:", err);
  process.exit(1);
});