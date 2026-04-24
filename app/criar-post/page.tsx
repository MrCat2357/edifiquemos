"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { addDoc, collection } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function CriarPost() {
  const router = useRouter();

  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [tipo, setTipo] = useState("sermao");

  // 🔄 recuperar rascunho ao abrir página
  useEffect(() => {
    const draft = sessionStorage.getItem("draft-post");

    if (draft) {
      const data = JSON.parse(draft);
      setTitulo(data.titulo || "");
      setConteudo(data.conteudo || "");
      setTipo(data.tipo || "sermao");
    }
  }, []);

  async function handleCriarPost(e: React.FormEvent) {
    e.preventDefault();

    const user = auth.currentUser;

    // 💾 sempre salva rascunho
    sessionStorage.setItem(
      "draft-post",
      JSON.stringify({ titulo, conteudo, tipo })
    );

    // 🔐 não logado → salva intenção e manda pro cadastro
    if (!user) {
      sessionStorage.setItem("redirect-after-auth", "/criar-post");
      router.push("/cadastro");
      return;
    }

    try {
      await addDoc(collection(db, "posts"), {
        titulo,
        conteudo,
        tipo,
        autorId: user.uid,
        autorNome: user.displayName || "Usuário",
        igreja: "",
        data: new Date(),
      });

      // 🧹 limpa rascunho após publicar
      sessionStorage.removeItem("draft-post");

      alert("Post criado com sucesso!");
      router.push("/posts");

    } catch (error) {
      console.error(error);
      alert("Erro ao criar post");
    }
  }

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">

      <h1 className="text-2xl font-bold">
        Criar Post
      </h1>

      <form onSubmit={handleCriarPost} className="space-y-4">

        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="w-full border p-2 rounded"
        >
          <option value="sermao">Sermão</option>
          <option value="artigo">Artigo</option>
        </select>

        <input
          className="w-full border p-2 rounded"
          placeholder="Título"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
        />

        <textarea
          className="w-full border p-2 rounded h-40"
          placeholder="Conteúdo..."
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
        />

        <button className="bg-blue-600 text-white px-4 py-2 rounded w-full">
          Publicar
        </button>

      </form>
    </div>
  );
}