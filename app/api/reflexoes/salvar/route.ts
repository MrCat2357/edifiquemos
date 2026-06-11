import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { gerarImagemReflexao } from "@/lib/gerarImagemReflexao";
import { gerarSlugUnico } from "@/lib/slug";
import type { ReflexaoGerada } from "@/lib/reflexoes";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  try {
    const {
      reflexoes,
      autorId,
      autorNome,
      autorSlug,
      publicacaoOrigemId,
      publicacaoOrigemSlug,
    }: {
      reflexoes: ReflexaoGerada[];
      autorId: string;
      autorNome: string;
      autorSlug: string;
      publicacaoOrigemId: string;
      publicacaoOrigemSlug: string;
    } = await req.json();

    if (!reflexoes || !Array.isArray(reflexoes) || reflexoes.length !== 3) {
      return NextResponse.json({ erro: "Envie exatamente 3 reflexões." }, { status: 400 });
    }
    if (!autorId || !autorNome || !autorSlug || !publicacaoOrigemId || !publicacaoOrigemSlug) {
      return NextResponse.json({ erro: "Campos obrigatórios faltando." }, { status: 400 });
    }

    const postSnap = await adminDb.collection("posts").doc(publicacaoOrigemId).get();
    if (!postSnap.exists) {
      return NextResponse.json({ erro: "Publicação de origem não encontrada." }, { status: 404 });
    }

    const postData = postSnap.data()!;
    const imagemCapaOrigem: string = postData.imagemCapa ?? "";
    const publicacaoOrigemTipo: "sermao" | "artigo" =
      postData.tipo === "artigo" ? "artigo" : "sermao";

    // Busca a foto do autor no perfil — não bloqueia a criação se falhar
    let autorFoto: string | null = null;
    try {
      const userSnap = await adminDb.collection("users").doc(autorId).get();
      if (userSnap.exists) {
        autorFoto = userSnap.data()?.fotoUrl ?? null;
      }
    } catch (err) {
      console.warn("[reflexoes/salvar] Não foi possível buscar autorFoto:", err);
      // autorFoto permanece null — criação prossegue normalmente
    }

    // Gera imagem única por reflexão em paralelo
    const imagensGeradas = await Promise.all(
      reflexoes.map((r) => gerarImagemReflexao(r.titulo, imagemCapaOrigem))
    );

    const slugsSalvos: string[] = [];

    for (let i = 0; i < reflexoes.length; i++) {
      const r = reflexoes[i];
      const imagem = imagensGeradas[i];
      const slug = await gerarSlugUnico(autorNome, r.titulo);

      await adminDb.collection("posts").add({
        slug,
        autorId,
        autorNome,
        autorSlug,
        autorFoto,                    // ← campo adicionado
        publicacaoOrigemId,
        publicacaoOrigemSlug,
        publicacaoOrigemTipo,
        titulo: r.titulo,
        conteudo: r.conteudo,
        fraseInstigadora: r.fraseInstigadora,
        perguntaReflexiva: r.perguntaReflexiva,
        ctaTexto: r.ctaTexto,
        imagemCapa: imagem.url,
        imagemFotografoNome: imagem.fotografoNome,
        imagemFotografoUrl: imagem.fotografoUrl,
        imagemUnsplashUrl: imagem.unsplashUrl,
        tipo: "reflexao",
        criadoEm: FieldValue.serverTimestamp(),
      });

      slugsSalvos.push(slug);
    }

    return NextResponse.json({ slugs: slugsSalvos });
  } catch (err: unknown) {
    const mensagem = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json({ erro: mensagem }, { status: 500 });
  }
}