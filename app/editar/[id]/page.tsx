"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";

export default function EditarPost() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [tipo, setTipo] = useState("sermao");
  const [igreja, setIgreja] = useState("");
  const [data, setData] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchPost() {
      if (!id) return;

      try {
        const ref = doc(db, "posts", id);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setError("Post não encontrado.");
          return;
        }

        const data = snap.data();

        // 🔐 segurança: só autor pode editar
        if (auth.currentUser?.uid !== data.autorId) {
          setError("Você não tem permissão para editar este post.");
          return;
        }

        setTitulo(data.titulo || "");
        setConteudo(data.conteudo || "");
        setTipo(data.tipo || "sermao");
        setIgreja(data.igreja || "");

        if (data.data?.toDate) {
          const d = data.data.toDate();
          setData(d.toISOString().split("T")[0]);
        }

      } catch (err) {
        console.error(err);
        setError("Erro ao carregar post.");
      } finally {
        setLoading(false);
      }
    }

    fetchPost();
  }, [id]);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();

    if (!titulo.trim() || !conteudo.trim()) {
      setError("Título e conteúdo são obrigatórios.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const ref = doc(db, "posts", id);

      await updateDoc(ref, {
        titulo,
        conteudo,
        tipo,
        igreja,
        data: data ? new Date(data) : new Date(),
      });

      router.push(`/post/${id}`);
    } catch (err) {
      console.error(err);
      setError("Erro ao atualizar post.");
    }

    setSaving(false);
  }

  if (loading) {
    return <p className="p-4 text-neutral-400">Carregando...</p>;
  }

  if (error) {
    return <p className="p-4 text-red-400">{error}</p>;
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">

      <h1 className="text-2xl font-bold text-neutral-100">
        Editar Post
      </h1>

      <form onSubmit={handleUpdate} className="space-y-4">

        {/* TIPO */}
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="w-full bg-neutral-800 border border-neutral-700 text-neutral-100 p-2 rounded"
        >
          <option value="sermao">Sermão</option>
          <option value="artigo">Artigo</option>
        </select>

        {/* TÍTULO */}
        <input
          className="w-full bg-neutral-800 border border-neutral-700 text-neutral-100 p-2 rounded"
          placeholder="Título"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
        />

        {/* CONTEÚDO */}
        <textarea
          className="w-full bg-neutral-800 border border-neutral-700 text-neutral-100 p-2 rounded h-40"
          placeholder="Conteúdo..."
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
        />

        {/* IGREJA (opcional) */}
        <input
          className="w-full bg-neutral-800 border border-neutral-700 text-neutral-100 p-2 rounded"
          placeholder="Igreja (opcional)"
          value={igreja}
          onChange={(e) => setIgreja(e.target.value)}
        />

        {/* DATA (opcional) */}
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="w-full bg-neutral-800 border border-neutral-700 text-neutral-100 p-2 rounded"
        />

        {/* BOTÃO */}
        <button
          type="submit"
          disabled={saving}
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
          {saving ? "Salvando..." : "Salvar alterações"}
        </button>

      </form>
    </div>
  );
}