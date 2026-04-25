"use client";

import Link from "next/link";
import { useAuth } from "@/lib/useAuth";

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100">
      <div className="max-w-2xl mx-auto px-6 py-20 text-center space-y-10">

        {/* ✝️ VERSÍCULO (REFINADO) */}
        <div className="relative bg-neutral-800/60 border border-neutral-700 rounded-xl p-6 space-y-4 shadow-md">

          {/* barra lateral espiritual */}
          <div className="absolute left-0 top-0 h-full w-1 bg-emerald-500 rounded-l-xl" />

          <h1 className="text-2xl md:text-3xl font-semibold leading-relaxed text-neutral-100">
            “Por isso, exortem-se e edifiquem-se uns aos outros,
            <br />
            como de fato vocês estão fazendo.”
          </h1>

          <p className="text-emerald-400 text-sm font-medium">
            1 Tessalonicenses 5:11
          </p>
        </div>

        {/* 🌿 PROPÓSITO */}
        <div className="space-y-4">
          <p className="text-neutral-200 text-lg leading-relaxed">
            Um espaço para edificação mútua.
          </p>

          <p className="text-neutral-300">
            Aqui, irmãos na fé compartilham sermões, reflexões e ensinamentos
            para fortalecer uns aos outros na caminhada cristã.
          </p>
        </div>

        {/* 🔘 BOTÕES PADRONIZADOS */}
        <div className="flex flex-col gap-3 items-center">

          <Link
            href="/posts"
            className="w-64 py-3 rounded bg-emerald-600 hover:bg-emerald-700 transition font-medium shadow-md active:scale-95"
          >
            Ler Conteúdos
          </Link>

          <Link
            href="/criar-post"
            className="w-64 py-3 rounded bg-emerald-600 hover:bg-emerald-700 transition font-medium shadow-md active:scale-95"
          >
            Publicar Sermões ou Artigos
          </Link>

        </div>

        {/* 🔐 OBSERVAÇÃO */}
        {!user && (
          <p className="text-sm text-neutral-500">
            É necessário estar logado para publicar conteúdos.
          </p>
        )}

      </div>
    </div>
  );
}