"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import { addDoc, collection } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function CriarPost() {
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [tipo, setTipo] = useState("sermao");

  const router = useRouter();

  async function handleCriarPost(e: React.FormEvent) {
    e.preventDefault();

    if (!auth.currentUser) {
      alert("Você precisa estar logado");
      return;
    }

    try {
      const user = auth.currentUser;

      await addDoc(collection(db, "posts"), {
        titulo,
        conteudo,
        tipo,
        autorId: user.uid,
        autorNome: user.displayName || "Usuário",
        igreja: "",
        data: new Date(),
      });

      alert("Post criado com sucesso!");
      router.push("/posts");
    } catch (error) {
      console.error("Erro ao criar post:", error);
      alert("Erro ao criar post");
    }
  }

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">Criar Post</h1>

      <form onSubmit={handleCriarPost} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Tipo</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="w-full border p-2 rounded"
          >
            <option value="sermao">Sermão</option>
            <option value="artigo">Artigo</option>
          </select>
        </div>

        <input
          className="w-full border p-2 rounded"
          placeholder="Título do post"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
        />

        <textarea
          className="w-full border p-2 rounded h-40"
          placeholder="Conteúdo..."
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
        />

        <button className="bg-blue-600 text-white px-4 py-2 rounded">
          Publicar
        </button>
      </form>
    </div>
  );
}