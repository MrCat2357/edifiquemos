"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function CriarPost() {
  const router = useRouter();

  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [tipo, setTipo] = useState("sermao");
  const [igreja, setIgreja] = useState("");
  const [data, setData] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 🔄 recuperar rascunho
  useEffect(() => {
    const draft = sessionStorage.getItem("draft-post");

    if (draft) {
      const data = JSON.parse(draft);
      setTitulo(data.titulo || "");
      setConteudo(data.conteudo || "");
      setTipo(data.tipo || "sermao");
      setIgreja(data.igreja || "");
      setData(data.data || "");
    }
  }, []);

  async function handleCriarPost(e: React.FormEvent) {
    e.preventDefault();

    if (loading) return; // 🚫 evita clique duplo

    setError("");

    if (!titulo.trim() || !conteudo.trim()) {
      setError("Título e conteúdo são obrigatórios.");
      return;
    }

    setLoading(true);

    const user = auth.currentUser;

    // 💾 salva rascunho sempre
    sessionStorage.setItem(
      "draft-post",
      JSON.stringify({ titulo, conteudo, tipo, igreja, data })
    );

    // 🔐 não logado
    if (!user) {
      sessionStorage.setItem("redirect-after-auth", "/criar-post");
      router.push("/cadastro");
      return;
    }

    try {
      // 🔍 VERIFICAR DUPLICADO
      const q = query(
        collection(db, "posts"),
        where("autorId", "==", user.uid),
        where("titulo", "==", titulo.trim())
      );

      const snapshot = await getDocs(q);

      let duplicado = false;

      snapshot.forEach((doc) => {
        const p = doc.data();

        if (
          p.conteudo?.trim() === conteudo.trim()
        ) {
          duplicado = true;
        }
      });

      if (duplicado) {
        setError("Você já publicou esse conteúdo.");
        setLoading(false);
        return;
      }

      // ✅ CRIAR POST
      const docRef = await addDoc(collection(db, "posts"), {
        titulo: titulo.trim(),
        conteudo: conteudo.trim(),
        tipo,
        igreja: igreja || "",
        data: data ? new Date(data) : new Date(),
        autorId: user.uid,
        autorNome: user.displayName || "Usuário",
      });

      // 🧹 limpar rascunho
      sessionStorage.removeItem("draft-post");

      // 🚀 ir direto pro post
      router.push(`/post/${docRef.id}`);

    } catch (err) {
      console.error(err);
      setError("Erro ao criar post.");
    }

    setLoading(false);
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">

      <h1 className="text-2xl font-bold text-neutral-100">
        Criar Post
      </h1>

      <form onSubmit={handleCriarPost} className="space-y-4">

        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="w-full bg-neutral-800 border border-neutral-700 text-neutral-100 p-2 rounded"
        >
          <option value="sermao">Sermão</option>
          <option value="artigo">Artigo</option>
        </select>

        <input
          className="w-full bg-neutral-800 border border-neutral-700 text-neutral-100 p-2 rounded"
          placeholder="Título"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
        />

        <textarea
          className="w-full bg-neutral-800 border border-neutral-700 text-neutral-100 p-2 rounded h-40"
          placeholder="Conteúdo..."
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
        />

        <input
          className="w-full bg-neutral-800 border border-neutral-700 text-neutral-100 p-2 rounded"
          placeholder="Igreja (opcional)"
          value={igreja}
          onChange={(e) => setIgreja(e.target.value)}
        />

        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="w-full bg-neutral-800 border border-neutral-700 text-neutral-100 p-2 rounded"
        />

        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="
            w-full
            bg-emerald-600
            hover:bg-emerald-700
            text-white
            p-2
            rounded
            transition
            cursor-pointer
            active:scale-95
            disabled:opacity-50
          "
        >
          {loading ? "Publicando..." : "Publicar"}
        </button>

      </form>
    </div>
  );
}