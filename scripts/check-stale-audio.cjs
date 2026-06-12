#!/usr/bin/env node
/**
 * scripts/check-stale-audio.cjs
 *
 * Varre todos os posts com audioStatus "ready", recalcula o hash SHA-256
 * do conteúdo atual e compara com audioContentHash salvo no Firestore.
 * Posts com hash divergente têm audioStatus alterado para "stale".
 *
 * NÃO gera áudio — apenas marca. Use generate-all-audio.cjs em seguida
 * para regenerar o backlog:
 *
 *   node scripts/check-stale-audio.cjs
 *   node scripts/generate-all-audio.cjs
 *
 * Uso:
 *   # Staging (.env.local)
 *   node scripts/check-stale-audio.cjs
 *
 *   # Produção (.env.production.local)
 *   $env:NODE_ENV="production"; node scripts/check-stale-audio.cjs   (PowerShell)
 *   NODE_ENV=production node scripts/check-stale-audio.cjs            (bash)
 */

"use strict";

const path   = require("path");
const fs     = require("fs");
const dotenv = require("dotenv");

// ---------------------------------------------------------------------------
// Carregamento de variáveis de ambiente
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
// Hash SHA-256 — espelha lib/tts/hash.ts sem depender do compilador TS
// Usa a Web Crypto API nativa do Node.js 18+
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

  console.log('🔍  Buscando posts com audioStatus "ready"...\n');

  // Busca apenas posts que já têm áudio gerado ("ready")
  const snapshot = await db
    .collection("posts")
    .where("audioStatus", "==", "ready")
    .get();

  if (snapshot.empty) {
    console.log('✅  Nenhum post com audioStatus "ready" encontrado.\n');
    return;
  }

  const total = snapshot.docs.length;
  console.log(`📋  ${total} post(s) com audioStatus "ready" encontrado(s).\n`);

  let verificados = 0;
  let marcados    = 0;
  let semHash     = 0;
  let semConteudo = 0;
  let erros       = 0;

  for (const docSnap of snapshot.docs) {
    const postId   = docSnap.id;
    const postData = docSnap.data();

    const titulo           = (postData.titulo           ?? "").slice(0, 55);
    const conteudo         = postData.conteudo         ?? null;
    const audioContentHash = postData.audioContentHash ?? null;

    // ── Sem conteúdo: não há o que verificar ──────────────────────────────
    if (!conteudo) {
      console.log(`  ⚠  [sem conteúdo]   ${postId}  "${titulo}"`);
      semConteudo++;
      continue;
    }

    // ── Sem hash salvo: foi gerado antes do sistema de hash existir ────────
    // Marcar como stale para forçar regeneração com hash correto.
    if (!audioContentHash) {
      console.log(`  ⚠  [sem hash]       ${postId}  "${titulo}"  → marcando stale`);
      try {
        await docSnap.ref.update({
          audioStatus:    "stale",
          audioUpdatedAt: Timestamp.now(),
        });
        marcados++;
      } catch (err) {
        console.error(`      ❌  Erro ao atualizar ${postId}:`, err.message);
        erros++;
      }
      semHash++;
      continue;
    }

    // ── Calcular hash atual e comparar ────────────────────────────────────
    let hashAtual;
    try {
      hashAtual = await computarHashConteudo(conteudo);
    } catch (err) {
      console.error(`  ❌  [erro hash]     ${postId}  "${titulo}":`, err.message);
      erros++;
      continue;
    }

    verificados++;

    if (hashAtual === audioContentHash) {
      // Hash igual — áudio está atualizado
      process.stdout.write(`  ✅  [ok]            ${postId}  "${titulo}"\n`);
      continue;
    }

    // ── Hash divergiu: marcar como stale ──────────────────────────────────
    console.log(`  🔄  [stale]         ${postId}  "${titulo}"`);
    try {
      await docSnap.ref.update({
        audioStatus:    "stale",
        audioUpdatedAt: Timestamp.now(),
        // Mantém audioUrl e audioContentHash para que o player
        // continue servindo o áudio antigo enquanto o novo é gerado.
      });
      marcados++;
    } catch (err) {
      console.error(`      ❌  Erro ao atualizar ${postId}:`, err.message);
      erros++;
    }
  }

  // ── Relatório final ───────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(55));
  console.log(`📊  Relatório`);
  console.log("─".repeat(55));
  console.log(`  Total verificado    : ${total}`);
  console.log(`  Hash OK (atualizados): ${verificados - marcados + (verificados === 0 ? 0 : 0)}`);
  console.log(`  Marcados como stale : ${marcados}  (inclui ${semHash} sem hash anterior)`);
  if (semConteudo > 0) console.log(`  Sem conteúdo        : ${semConteudo}  (ignorados)`);
  if (erros > 0)       console.log(`  Erros               : ${erros}`);
  console.log("─".repeat(55));

  if (marcados > 0) {
    console.log(`\n⚡  ${marcados} post(s) marcado(s) como stale.`);
    console.log(`   Rode agora para regenerar o backlog:`);
    console.log(`   node scripts/generate-all-audio.cjs\n`);
  } else {
    console.log(`\n✅  Todos os áudios estão sincronizados com o conteúdo atual.\n`);
  }
}

main().catch((err) => {
  console.error("\n💥  Erro fatal:", err);
  process.exit(1);
});