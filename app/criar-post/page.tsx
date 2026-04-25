"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { addDoc, collection, doc, getDoc } from "firebase/firestore";
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
  const [mostrarAviso, setMostrarAviso] = useState(false);

  useEffect(() => {
    const draft = sessionStorage.getItem("draft-post");

    if (draft) {
      const d = JSON.parse(draft);
      setTitulo(d.titulo || "");
      setConteudo(d.conteudo || "");
      setTipo(d.tipo || "sermao");
      setIgreja(d.igreja || "");
      setData(d.data || "");
    }
  }, []);

  async function getAutorInfo(uid: string) {
    try {
      const ref = doc(db, "users", uid);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        return "Autor";
      }

      const data = snap.data();

      const nome = data?.nome?.trim();
      const titulo = data?.titulo?.trim();

      if (nome && titulo) return `${titulo} ${nome}`;
      if (nome) return nome;

      return "Autor";
    } catch {
      return "Autor";
    }
  }

  async function handleCriarPost(e: React.FormEvent) {
    e.preventDefault();

    if (loading) return;

    if (!titulo.trim() || !conteudo.trim()) {
      setError("Título e conteúdo são obrigatórios.");
      return;
    }

    const user = auth.currentUser;

    sessionStorage.setItem(
      "draft-post",
      JSON.stringify({ titulo, conteudo, tipo, igreja, data })
    );

    if (!user) {
      setMostrarAviso(true);
      return;
    }

    setLoading(true);

    try {
      const autorNome = await getAutorInfo(user.uid);

      await addDoc(collection(db, "posts"), {
        titulo: titulo.trim(),
        conteudo: conteudo.trim(),
        tipo,
        igreja: igreja.trim() || "",
        data: data || new Date(),
        autorId: user.uid,
        autorNome,
      });

      sessionStorage.removeItem("draft-post");

      router.push("/posts");
    } catch (err) {
      console.error(err);
      setError("Erro ao publicar.");
    }

    setLoading(false);
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">

      <h1 className="text-2xl font-bold text-neutral-100">
        Criar Post
      </h1>

      {/* 🚧 AVISO */}
      {mostrarAviso && (
        <div className="bg-neutral-800 border border-emerald-600 p-4 rounded text-center">

          <p className="text-neutral-200 mb-3">
            Para publicar, você precisa criar uma conta.
          </p>

          <button
            onClick={() => router.push("/cadastro")}
            className="bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded text-white cursor-pointer"
          >
            Ir para cadastro
          </button>

        </div>
      )}

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
          placeholder="Título"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          className="w-full bg-neutral-800 border border-neutral-700 p-2 rounded text-neutral-100"
        />

        <textarea
          placeholder="Conteúdo..."
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          className="w-full bg-neutral-800 border border-neutral-700 p-2 rounded text-neutral-100 h-40"
        />

        <input
          placeholder="Igreja (opcional)"
          value={igreja}
          onChange={(e) => setIgreja(e.target.value)}
          className="w-full bg-neutral-800 border border-neutral-700 p-2 rounded text-neutral-100"
        />

        <input
          placeholder="Data (ex: 04/2019 ou 2018)"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="w-full bg-neutral-800 border border-neutral-700 p-2 rounded text-neutral-100"
        />

        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="
            w-full
            bg-emerald-600 hover:bg-emerald-700
            text-white p-2 rounded
            cursor-pointer
            transition
            active:scale-95
          "
        >
          {loading ? "Publicando..." : "Publicar"}
        </button>

      </form>
    </div>
  );
}