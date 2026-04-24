"use client";

import Link from "next/link";
import { useAuth } from "@/lib/useAuth";

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100">
      <div className="max-w-2xl mx-auto px-6 py-20 text-center space-y-10">

        {/* ✝️ VERSÍCULO */}
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold leading-relaxed">
            “Assim como o ferro afia o ferro,
            <br />
            o homem afia o seu companheiro.”
          </h1>

          <p className="text-neutral-400 text-sm">
            Provérbios 27:17
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
    className="w-64 py-3 rounded bg-emerald-600 hover:bg-emerald-700 transition"
  >
    Ler Conteúdos
  </Link>

  <Link
    href="/criar-post"
    className="w-64 py-3 rounded bg-emerald-600 hover:bg-emerald-700 transition"
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