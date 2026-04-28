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
  const [slug, setSlug] = useState("");

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

        const postData = snap.data();

        if (auth.currentUser?.uid !== postData.autorId) {
          setError("Você não tem permissão para editar este post.");
          return;
        }

        setTitulo(postData.titulo || "");
        setConteudo(postData.conteudo || "");
        setTipo(postData.tipo || "sermao");
        setIgreja(postData.igreja || "");
        setSlug(postData.slug || "");

        // ✅ lê data como string — compatível com o novo formato livre
        // mas também suporta posts antigos que tinham Timestamp
        if (typeof postData.data === "string") {
          setData(postData.data);
        } else if (postData.data?.toDate) {
          // posts antigos salvos como Timestamp — converte para string legível
          const d = postData.data.toDate();
          setData(
            d.toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })
          );
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
        data: data.trim() || "",  // ✅ salva como string livre
      });

      router.push(`/posts/${tipo === "sermao" ? "sermoes" : "artigos"}/${slug}`);
    } catch (err) {
      console.error(err);
      setError("Erro ao atualizar post.");
    }

    setSaving(false);
  }

  if (loading) return (
    <div className="post-detail-loading">
      <div className="spinner" />
      <span>Carregando...</span>
    </div>
  );

  if (error) return (
    <div className="post-detail-notfound">{error}</div>
  );

  return (
    <div className="post-detail-wrapper" style={{ maxWidth: 640 }}>
      <div className="post-detail-card">

        <h1 className="post-detail-title" style={{ fontSize: "1.6rem" }}>
          Editar Post
        </h1>

        <hr className="post-detail-divider" />

        <form onSubmit={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

          {/* Tipo */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <label className="auth-label">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="auth-input"
            >
              <option value="sermao">Sermão</option>
              <option value="artigo">Artigo</option>
            </select>
          </div>

          {/* Título */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <label className="auth-label">Título</label>
            <input
              className="auth-input"
              placeholder="Título"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>

          {/* Conteúdo */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <label className="auth-label">Conteúdo</label>
            <textarea
              className="auth-input"
              placeholder="Conteúdo..."
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              style={{ height: 180, resize: "vertical" }}
            />
          </div>

          {/* Igreja */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <label className="auth-label">
              Igreja <span className="auth-label-opt">(opcional)</span>
            </label>
            <input
              className="auth-input"
              placeholder="Igreja"
              value={igreja}
              onChange={(e) => setIgreja(e.target.value)}
            />
          </div>

          {/* Data */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <label className="auth-label">
              Data <span className="auth-label-opt">(opcional)</span>
            </label>
            {/* ✅ type="text" — aceita qualquer formato livre */}
            <input
              type="text"
              placeholder="Ex: 2025, Século XVI, 15 de maio de 2022…"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="auth-input"
            />
          </div>

          {/* Erro */}
          {error && (
            <div className="auth-error">
              <p>{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={saving}
            className="auth-btn-primary"
          >
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>

        </form>
      </div>
    </div>
  );
}