"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { addDoc, collection, doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { gerarSlugUnico } from "@/lib/slug";
import FileImportButton from "@/components/Button";
import type { LinkReferencia } from "@/components/LinksReferencia";

const TIPO_LINK_OPTIONS: { value: LinkReferencia["tipo"]; label: string; icon: string }[] = [
  { value: "youtube", label: "YouTube", icon: "▶" },
  { value: "blog",    label: "Blog / Site", icon: "✍" },
  { value: "livro",   label: "Livro", icon: "📖" },
  { value: "site",    label: "Site", icon: "🌐" },
  { value: "outro",   label: "Outro", icon: "🔗" },
];

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
  const [links, setLinks] = useState<LinkReferencia[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mostrarAviso, setMostrarAviso] = useState(false);

  const [corrigindo, setCorrigindo] = useState(false);
  const [mostrarBotaoCorrigir, setMostrarBotaoCorrigir] = useState(false);
  const [correcaoFeita, setCorrecaoFeita] = useState(false);

  useEffect(() => {
    const draft = sessionStorage.getItem("draft-post");
    if (draft) {
      const d = JSON.parse(draft);
      setTitulo(d.titulo || "");
      setConteudo(d.conteudo || "");
      setTipo(d.tipo || "sermao");
      setIgreja(d.igreja || "");
      setData(d.data || "");
      setLinks(d.links || []);
    }
  }, []);

  useEffect(() => {
    setMostrarBotaoCorrigir(conteudo.trim().length > 20);
    setCorrecaoFeita(false);
  }, [conteudo]);

  /* ── Links helpers ── */

  function addLink() {
    setLinks((prev) => [...prev, { label: "", url: "", tipo: "youtube" }]);
  }

  function removeLink(i: number) {
    setLinks((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateLink(i: number, field: keyof LinkReferencia, value: string) {
    setLinks((prev) =>
      prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l))
    );
  }

  /* ── Correção gramatical ── */

  async function corrigirGramatica() {
    if (!conteudo.trim() || corrigindo) return;
    setCorrigindo(true);
    try {
      const response = await fetch("/api/corrigir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conteudo }),
      });
      const dataResp = await response.json();
      if (dataResp?.texto) {
        setConteudo(dataResp.texto);
        setCorrecaoFeita(true);
      }
    } catch (err) {
      console.error("Erro ao corrigir:", err);
    }
    setCorrigindo(false);
  }

  /* ── Submit ── */

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
      JSON.stringify({ titulo, conteudo, tipo, igreja, data, links })
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

      // Filtra links incompletos antes de salvar
      const linksFiltrados = links.filter((l) => l.label.trim() && l.url.trim());

      await addDoc(collection(db, "posts"), {
        titulo: titulo.trim().toUpperCase(),
        conteudo: conteudo.trim(),
        tipo,
        igreja: igreja.trim() || "",
        data: data.trim() || "",
        autorId: user.uid,
        autorNome,
        autorFoto: autorFoto ?? null,
        slug,
        links: linksFiltrados,
      });

      sessionStorage.removeItem("draft-post");
      router.push(`/posts/${tipo === "sermao" ? "sermoes" : "artigos"}/${slug}`);
    } catch (err) {
      console.error(err);
      setError("Erro ao publicar.");
    }

    setLoading(false);
  }

  /* ── Render ── */

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
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "0.5rem",
                marginBottom: "0.375rem",
              }}
            >
              <label className="auth-label" style={{ margin: 0 }}>
                Conteúdo
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <FileImportButton
                  onImport={(texto) =>
                    setConteudo((prev) =>
                      prev.trim() ? prev + "\n\n" + texto : texto
                    )
                  }
                />
                {mostrarBotaoCorrigir && (
                  <button
                    type="button"
                    onClick={corrigirGramatica}
                    disabled={corrigindo}
                    title="Corrigir erros de gramática e ortografia com IA"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      padding: "5px 12px",
                      borderRadius: "var(--radius-full)",
                      border: correcaoFeita
                        ? "1px solid var(--emerald)"
                        : "1px solid var(--border-light)",
                      background: correcaoFeita
                        ? "var(--emerald-dim)"
                        : "var(--bg-elevated)",
                      color: correcaoFeita ? "var(--emerald)" : "var(--text-2)",
                      fontWeight: 600,
                      fontSize: "0.78rem",
                      cursor: corrigindo ? "wait" : "pointer",
                      transition: "all 0.2s",
                      whiteSpace: "nowrap",
                      opacity: corrigindo ? 0.7 : 1,
                    }}
                  >
                    {corrigindo ? (
                      <>
                        <span
                          style={{
                            display: "inline-block",
                            width: "10px",
                            height: "10px",
                            border: "2px solid var(--text-3)",
                            borderTopColor: "var(--emerald)",
                            borderRadius: "50%",
                            animation: "spin 0.7s linear infinite",
                          }}
                        />
                        Corrigindo...
                      </>
                    ) : correcaoFeita ? (
                      <>✓ Corrigido</>
                    ) : (
                      <>✦ Corrigir texto</>
                    )}
                  </button>
                )}
              </div>
            </div>
            <textarea
              placeholder="Escreva seu sermão ou artigo aqui, ou importe um arquivo acima..."
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              className="auth-input"
              style={{ minHeight: "14rem", resize: "vertical", lineHeight: 1.75 }}
            />
          </div>

          {/* Igreja e Data */}
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
              <input
                type="text"
                placeholder="Ex: 2025, Século XVI…"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="auth-input"
              />
            </div>
          </div>

          {/* ── Links de Referência ── */}
          <div className="auth-field">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <div>
                <label className="auth-label" style={{ margin: 0 }}>
                  Links de referência <span className="auth-label-opt">(opcional)</span>
                </label>
                <p style={{ fontSize: "0.72rem", color: "var(--text-3)", marginTop: "2px" }}>
                  YouTube, blog, livro, site… aparecem como botões visuais no post
                </p>
              </div>
              <button
                type="button"
                onClick={addLink}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  padding: "5px 12px",
                  borderRadius: "var(--radius-full)",
                  border: "1px solid var(--border-light)",
                  background: "var(--bg-elevated)",
                  color: "var(--emerald)",
                  fontWeight: 600,
                  fontSize: "0.78rem",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s",
                }}
              >
                + Adicionar
              </button>
            </div>

            {links.length === 0 && (
              <div
                style={{
                  border: "1px dashed var(--border-light)",
                  borderRadius: "var(--radius-lg)",
                  padding: "1.25rem",
                  textAlign: "center",
                  color: "var(--text-3)",
                  fontSize: "0.82rem",
                }}
              >
                Nenhum link adicionado ainda.
                <br />
                <span style={{ color: "var(--emerald)", cursor: "pointer", fontWeight: 600 }} onClick={addLink}>
                  Clique em "+ Adicionar"
                </span>{" "}
                para inserir um link de referência.
              </div>
            )}

            {links.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {links.map((link, i) => (
                  <div
                    key={i}
                    style={{
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border-light)",
                      borderRadius: "var(--radius-lg)",
                      padding: "0.875rem 1rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.625rem",
                    }}
                  >
                    {/* Tipo + remover */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <label style={{ fontSize: "0.72rem", color: "var(--text-3)", fontWeight: 600, marginRight: "0.25rem" }}>
                        Tipo:
                      </label>
                      <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap", flex: 1 }}>
                        {TIPO_LINK_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => updateLink(i, "tipo", opt.value)}
                            style={{
                              padding: "3px 10px",
                              borderRadius: "var(--radius-full)",
                              border: link.tipo === opt.value
                                ? "1px solid var(--emerald)"
                                : "1px solid var(--border-light)",
                              background: link.tipo === opt.value ? "var(--emerald-dim)" : "var(--bg-card)",
                              color: link.tipo === opt.value ? "var(--emerald)" : "var(--text-3)",
                              fontSize: "0.72rem",
                              fontWeight: 600,
                              cursor: "pointer",
                              transition: "all 0.15s",
                            }}
                          >
                            {opt.icon} {opt.label}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLink(i)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--text-3)",
                          cursor: "pointer",
                          fontSize: "1rem",
                          padding: "2px 6px",
                          borderRadius: "var(--radius-sm)",
                          transition: "color 0.15s",
                          flexShrink: 0,
                        }}
                        title="Remover link"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Label */}
                    <input
                      placeholder={
                        link.tipo === "youtube" ? "Ex: Acompanhe meu canal no YouTube" :
                        link.tipo === "blog"    ? "Ex: Veja o conteúdo completo no meu blog" :
                        link.tipo === "livro"   ? "Ex: Adquira já seu exemplar do livro" :
                        link.tipo === "site"    ? "Ex: Acesse nosso site" :
                        "Ex: Veja mais conteúdo aqui"
                      }
                      value={link.label}
                      onChange={(e) => updateLink(i, "label", e.target.value)}
                      className="auth-input"
                      style={{ fontSize: "0.85rem", padding: "8px 12px" }}
                    />

                    {/* URL */}
                    <input
                      placeholder="https://..."
                      value={link.url}
                      onChange={(e) => updateLink(i, "url", e.target.value)}
                      className="auth-input"
                      style={{ fontSize: "0.82rem", padding: "8px 12px", color: "var(--text-3)" }}
                    />
                  </div>
                ))}
              </div>
            )}
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

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}