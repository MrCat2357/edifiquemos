/**
 * app/[autorSlug]/reflexao/[slug]/page.tsx
 *
 * Página pública de uma reflexão individual.
 *
 * Open Graph exportado aqui garante que ao colar o link no WhatsApp,
 * ele puxe: imagem única da reflexão + frase instigadora + título.
 */

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getReflexaoPorSlug } from "@/lib/reflexoes";
import ReflexaoView from "@/components/reflexoes/ReflexaoView";

type Props = {
  params: { autorSlug: string; slug: string };
};

// ── Open Graph ────────────────────────────────────────────────────────────────
// É isso que o WhatsApp lê ao pré-visualizar o link.
// imagemCapa é a imagem gerada por IA para o microtema desta reflexão.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const reflexao = await getReflexaoPorSlug(params.slug);
  if (!reflexao) return { title: "Reflexão não encontrada" };

  return {
    title: reflexao.titulo,
    description: reflexao.fraseInstigadora,
    openGraph: {
      title: reflexao.titulo,
      description: reflexao.fraseInstigadora,
      url: `https://edifiquemos.com.br/${params.autorSlug}/reflexao/${params.slug}`,
      siteName: "Edifiquemos",
      images: [
        {
          url: reflexao.imagemCapa,
          width: 1200,
          height: 630,
          alt: reflexao.titulo,
        },
      ],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: reflexao.titulo,
      description: reflexao.fraseInstigadora,
      images: [reflexao.imagemCapa],
    },
  };
}

// ── Página ────────────────────────────────────────────────────────────────────
export default async function PaginaReflexao({ params }: Props) {
  const reflexao = await getReflexaoPorSlug(params.slug);
  if (!reflexao) notFound();

  return (
    <ReflexaoView
      reflexao={reflexao}
      autorSlug={params.autorSlug}
    />
  );
}