import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getReflexaoPorSlugAdmin } from "@/lib/reflexoesAdmin";
import ReflexaoView from "@/components/reflexoes/ReflexaoView";

type Props = {
  params: Promise<{ autorSlug: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, autorSlug } = await params;
  const reflexao = await getReflexaoPorSlugAdmin(slug);
  if (!reflexao) return { title: "Reflexão não encontrada" };

  return {
    title: reflexao.titulo,
    description: reflexao.fraseInstigadora,
    openGraph: {
      title: reflexao.titulo,
      description: reflexao.fraseInstigadora,
      url: `https://edifiquemos.com.br/${autorSlug}/reflexao/${slug}`,
      siteName: "Edifiquemos",
      images: [{ url: reflexao.imagemCapa, width: 1200, height: 630, alt: reflexao.titulo }],
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

export default async function PaginaReflexao({ params }: Props) {
  const { slug, autorSlug } = await params;
  const reflexao = await getReflexaoPorSlugAdmin(slug);
  if (!reflexao) notFound();

  return <ReflexaoView reflexao={reflexao!} autorSlug={autorSlug} />;
}