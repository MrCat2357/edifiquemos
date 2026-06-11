#!/usr/bin/env node
/**
 * scripts/fix-reflexao-autor-foto.cjs
 *
 * Corrige reflexões existentes que não têm autorFoto preenchido.
 * Para cada uma, busca fotoUrl na coleção "users" pelo campo autorId
 * e atualiza o documento. Também marca audioStatus = "stale" para que
 * generate-all-audio.cjs regenere o áudio na próxima execução.
 *
 * Uso:
 *   # Staging (.env.local)
 *   node scripts/fix-reflexao-autor-foto.cjs
 *
 *   # Produção (.env.production.local)
 *   $env:NODE_ENV="production"; node scripts/fix-reflexao-autor-foto.cjs   # PowerShell
 *   NODE_ENV=production node scripts/fix-reflexao-autor-foto.cjs            # bash/zsh
 */

"use strict";

const path   = require("path");
const fs     = require("fs");
const dotenv = require("dotenv");

// ── Ambiente ─────────────────────────────────────────────────────────────────

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

// ── Firebase Admin ────────────────────────────────────────────────────────────

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

// ── Main ──────────────────────────────────────────────────────────────────────

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

  console.log('🔍  Buscando reflexões sem autorFoto...\n');

  // Busca todas as reflexões
  const snapshot = await db.collection("posts")
    .where("tipo", "==", "reflexao")
    .get();

  // Filtra apenas as que não têm autorFoto preenchido
  const semFoto = snapshot.docs.filter((doc) => {
    const d = doc.data();
    return d.autorFoto === undefined || d.autorFoto === null;
  });

  const totalVerificados = snapshot.docs.length;

  if (semFoto.length === 0) {
    console.log(`✅  Todas as ${totalVerificados} reflexão(ões) já têm autorFoto. Nada a fazer.\n`);
    return;
  }

  console.log(`📋  ${totalVerificados} reflexão(ões) verificada(s)`);
  console.log(`⚠️   ${semFoto.length} sem autorFoto — iniciando correção...\n`);

  // Cache de usuários já consultados para evitar leituras repetidas
  const cacheUsuarios = new Map();

  let atualizados   = 0;
  let semFotoCadast = 0; // usuário não tem fotoUrl no perfil

  for (let i = 0; i < semFoto.length; i++) {
    const docSnap = semFoto[i];
    const d       = docSnap.data();
    const pre     = `[${i + 1}/${semFoto.length}]`;

    const autorId   = d.autorId   ?? null;
    const autorNome = d.autorNome ?? "(sem nome)";
    const titulo    = (d.titulo   ?? "").slice(0, 55);

    console.log(`${pre} 📄  ${titulo}`);
    console.log(`         autor : ${autorNome} (${autorId ?? "sem autorId"})`);

    if (!autorId) {
      console.log(`         ⚠️   autorId ausente — pulando\n`);
      semFotoCadast++;
      continue;
    }

    // Busca fotoUrl do autor (com cache)
    let fotoUrl = null;

    try {
      if (cacheUsuarios.has(autorId)) {
        fotoUrl = cacheUsuarios.get(autorId);
      } else {
        const userSnap = await db.collection("users").doc(autorId).get();
        fotoUrl = userSnap.exists ? (userSnap.data()?.fotoUrl ?? null) : null;
        cacheUsuarios.set(autorId, fotoUrl);
      }
    } catch (err) {
      console.error(`         ❌  Erro ao buscar usuário: ${err.message}`);
      semFotoCadast++;
      console.log();
      continue;
    }

    if (!fotoUrl) {
      console.log(`         ℹ️   Usuário não tem fotoUrl cadastrada — pulando\n`);
      semFotoCadast++;
      continue;
    }

    // Atualiza o documento
    try {
      await db.collection("posts").doc(docSnap.id).set(
        {
          autorFoto:      fotoUrl,
          audioStatus:    "stale",        // força regeneração do áudio
          audioUpdatedAt: Timestamp.now(),
        },
        { merge: true }
      );
      console.log(`         ✅  Atualizado com autorFoto + audioStatus=stale\n`);
      atualizados++;
    } catch (err) {
      console.error(`         ❌  Erro ao atualizar documento: ${err.message}\n`);
    }
  }

  // ── Relatório ───────────────────────────────────────────────────────────────
  console.log("─".repeat(50));
  console.log(`📊  Relatório final`);
  console.log(`   Reflexões verificadas : ${totalVerificados}`);
  console.log(`   Documentos atualizados: ${atualizados}`);
  console.log(`   Sem foto cadastrada   : ${semFotoCadast}`);
  console.log();

  if (atualizados > 0) {
    console.log(`💡  Execute generate-all-audio.cjs para regenerar o áudio das reflexões corrigidas.`);
    console.log();
  }
}

main().catch((err) => {
  console.error("\n💥  Erro fatal:", err);
  process.exit(1);
});