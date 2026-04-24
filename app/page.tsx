"use client";

import Link from "next/link";
import { useAuth } from "@/lib/useAuth";

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="max-w-2xl mx-auto px-6 py-20 text-center space-y-8">

      {/* 🔥 MENSAGEM PRINCIPAL */}
      <h1 className="text-3xl font-bold leading-tight">
        Sabia que o seu conhecimento pode fortalecer outros irmãos na fé?
      </h1>

      <p className="text-gray-600 text-lg">
        Compartilhe sermões, reflexões e ensinamentos que edificam vidas.
      </p>

      {/* 🔘 BOTÕES PRINCIPAIS */}
      <div className="flex flex-col gap-3 items-center">

        <Link
          href="/criar-post"
          className="bg-black text-white px-6 py-3 rounded w-64"
        >
          Publicar sermão ou artigo
        </Link>

        <Link
          href="/posts"
          className="border px-6 py-3 rounded w-64"
        >
          Ver conteúdos
        </Link>
      </div>

      {/* 🔐 INFO EXTRA */}
      {!user && (
        <p className="text-sm text-gray-500">
          Para publicar conteúdos, é necessário criar uma conta.
        </p>
      )}

    </div>
  );
}