import { NextRequest, NextResponse } from "next/server";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { gerarReflexoesIA } from "@/lib/gerarReflexoes";

export async function POST(req: NextRequest) {
  try {
    const { postId } = await req.json();

    if (!postId) {
      return NextResponse.json(
        { erro: "postId é obrigatório." },
        { status: 400 }
      );
    }

    // Busca o post original no Firestore
    const q = query(
      collection(db, "posts"),
      where("__name__", "==", postId)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      return NextResponse.json(
        { erro: "Publicação não encontrada." },
        { status: 404 }
      );
    }

    const post = snap.docs[0].data();

    if (!post.conteudo || !post.titulo) {
      return NextResponse.json(
        { erro: "Publicação sem conteúdo ou título." },
        { status: 422 }
      );
    }

    // Gera as 3 reflexões via IA
    const reflexoes = await gerarReflexoesIA(post.conteudo, post.titulo);

    return NextResponse.json({ reflexoes });
  } catch (err: unknown) {
    const mensagem = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json({ erro: mensagem }, { status: 500 });
  }
}