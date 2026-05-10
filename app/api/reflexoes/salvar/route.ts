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

    // ── Validações ─────────────────────────────────────────────────────────
    if (!reflexoes || !Array.isArray(reflexoes) || reflexoes.length !== 3) {
      return NextResponse.json(
        { erro: "Envie exatamente 3 reflexões." },
        { status: 400 }
      );
    }
    if (!autorId || !autorNome || !autorSlug || !publicacaoOrigemId || !publicacaoOrigemSlug) {
      return NextResponse.json(
        { erro: "Campos do autor e da publicação de origem são obrigatórios." },
        { status: 400 }
      );
    }

    // ── Busca post de origem via Admin SDK ────────────────────────────────
    const postSnap = await adminDb.collection("posts").doc(publicacaoOrigemId).get();

    if (!postSnap.exists) {
      return NextResponse.json(
        { erro: "Publicação de origem não encontrada." },
        { status: 404 }
      );
    }

    const postData = postSnap.data()!;
    const imagemCapaOrigem: string = postData.imagemCapa ?? "";
    const publicacaoOrigemTipo: "sermao" | "artigo" =
      postData.tipo === "artigo" ? "artigo" : "sermao";

    // ── Gera imagem única por reflexão (em paralelo) ──────────────────────
    const imagensCapas = await Promise.all(
      reflexoes.map((r) => gerarImagemReflexao(r.titulo, imagemCapaOrigem))
    );

    // ── Salva cada reflexão no Firestore via Admin SDK ────────────────────
    const slugsSalvos: string[] = [];

    for (let i = 0; i < reflexoes.length; i++) {
      const r = reflexoes[i];
      const slug = await gerarSlugUnico(autorNome, r.titulo);
      const imagemCapa = imagensCapas[i] || imagemCapaOrigem;

      await adminDb.collection("posts").add({
        slug,
        autorId,
        autorNome,
        autorSlug,
        publicacaoOrigemId,
        publicacaoOrigemSlug,
        publicacaoOrigemTipo,
        titulo: r.titulo,
        conteudo: r.conteudo,
        fraseInstigadora: r.fraseInstigadora,
        perguntaReflexiva: r.perguntaReflexiva,
        ctaTexto: r.ctaTexto,
        imagemCapa,
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