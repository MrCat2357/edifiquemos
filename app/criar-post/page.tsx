"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { addDoc, collection, doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { gerarSlugUnico } from "@/lib/slug";

async function getAutorInfo(uid: string): Promise<{ nome: string; foto: string | null }> {
  try {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { nome: "Autor", foto: null };
    const data = snap.data();
    const nome = data?.nome?.trim();
    const titulo = data?.titulo?.trim();
    const foto = data?.fotoUrl ?? null;
    const nomeCompleto = nome && titulo ? `${titulo} ${nome}` : nome || "Autor";
    return { nome: nomeCompleto, foto };
  } catch {
    return { nome: "Autor", foto: null };
  }
}

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
    setError("");

    try {
      const { nome: autorNome, foto: autorFoto } = await getAutorInfo(user.uid);
      const slug = await gerarSlugUnico(autorNome, titulo);

      await addDoc(collection(db, "posts"), {
        titulo: titulo.trim(),
        conteudo: conteudo.trim(),
        tipo,
        igreja: igreja.trim() || "",
        data: data.trim() || "",   // ✅ salva como string livre
        autorId: user.uid,
        autorNome,
        autorFoto: autorFoto ?? null,
        slug,
      });

      sessionStorage.removeItem("draft-post");
      router.push(`/posts/${tipo === "sermao" ? "sermoes" : "artigos"}/${slug}`);
    } catch (err) {
      console.error(err);
      setError("Erro ao publicar.");
    }

    setLoading(false);
  }

  return (
    <div style={{ paddingTop: "calc(var(--header-h) + 2rem)", paddingBottom: "4rem" }}>
      <div
        style={{
          maxWidth: "680px",
          margin: "0 auto",
          padding: "0 1.25rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        }}
      >
        {/* Cabeçalho */}
        <div>
          <h1
            style={{
              fontSize: "clamp(1.4rem, 3vw, 2rem)",
              fontWeight: 800,
              color: "var(--text-1)",
              letterSpacing: "-0.02em",
              marginBottom: "0.25rem",
            }}
          >
            Publicar conteúdo
          </h1>
          <p style={{ fontSize: "0.875rem", color: "var(--text-3)" }}>
            Compartilhe um sermão ou artigo com a comunidade
          </p>
        </div>

        {/* Aviso de login */}
        {mostrarAviso && (
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--emerald-dim)",
              borderRadius: "var(--radius-lg)",
              padding: "1.5rem",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              gap: "0.875rem",
            }}
          >
            <p style={{ color: "var(--text-2)", fontSize: "0.9rem" }}>
              Para publicar, você precisa criar uma conta.
            </p>
            <button
              onClick={() => router.push("/cadastro")}
              className="btn-hero-primary"
              style={{ alignSelf: "center" }}
            >
              Criar conta agora
            </button>
          </div>
        )}

        {/* Card do formulário */}
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: "2rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
          {/* Tipo */}
          <div className="auth-field">
            <label className="auth-label">Tipo de conteúdo</label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {(["sermao", "artigo"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    borderRadius: "var(--radius-full)",
                    border: tipo === t
                      ? "1px solid var(--emerald)"
                      : "1px solid var(--border-light)",
                    background: tipo === t ? "var(--emerald)" : "var(--bg-elevated)",
                    color: tipo === t ? "#fff" : "var(--text-2)",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {t === "sermao" ? "Sermão" : "Artigo"}
                </button>
              ))}
            </div>
          </div>

          {/* Título */}
          <div className="auth-field">
            <label className="auth-label">Título</label>
            <input
              placeholder="Ex: A graça de Deus em Romanos 8"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="auth-input"
            />
          </div>

          {/* Conteúdo */}
          <div className="auth-field">
            <label className="auth-label">Conteúdo</label>
            <textarea
              placeholder="Escreva seu sermão ou artigo aqui..."
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              className="auth-input"
              style={{ minHeight: "14rem", resize: "vertical", lineHeight: 1.75 }}
            />
          </div>

          {/* Igreja e Data lado a lado */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div className="auth-field">
              <label className="auth-label">
                Igreja <span className="auth-label-opt">(opcional)</span>
              </label>
              <input
                placeholder="Nome da igreja"
                value={igreja}
                onChange={(e) => setIgreja(e.target.value)}
                className="auth-input"
              />
            </div>
            <div className="auth-field">
              <label className="auth-label">
                Data <span className="auth-label-opt">(opcional)</span>
              </label>
              {/* ✅ type="text" — aceita qualquer formato livre */}
              <input
                type="text"
                placeholder="Ex: 2025, Século XVI…"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="auth-input"
              />
            </div>
          </div>

          {/* Erro */}
          {error && (
            <div className="auth-error">
              <p>{error}</p>
            </div>
          )}

          {/* Botão */}
          <button
            type="button"
            onClick={handleCriarPost}
            disabled={loading}
            className="auth-btn-primary"
            style={{ marginTop: "0.25rem" }}
          >
            {loading ? "Publicando..." : "Publicar"}
          </button>
        </div>
      </div>
    </div>
  );
}