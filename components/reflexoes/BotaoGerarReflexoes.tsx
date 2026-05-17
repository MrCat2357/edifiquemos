"use client";

import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ReflexaoGerada } from "@/lib/reflexoes";

// ── Ícones ────────────────────────────────────────────────────

function IconSparkle({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M8 1v3M8 12v3M1 8h3M12 8h3M3.05 3.05l2.12 2.12M10.83 10.83l2.12 2.12M3.05 12.95l2.12-2.12M10.83 5.17l2.12-2.12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function IconX({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

// ── Tipos locais ──────────────────────────────────────────────

type PostSimples = {
  id: string;
  titulo: string;
  tipo: string;
  slug: string;
};

type Etapa = "selecionar" | "gerando" | "revisar" | "salvando" | "concluido";

type Props = {
  autorId: string;
  autorNome: string;
  autorSlug: string;
};

// ── Componente ────────────────────────────────────────────────

export default function BotaoGerarReflexoes({ autorId, autorNome, autorSlug }: Props) {
  const [aberto, setAberto] = useState(false);
  const [etapa, setEtapa] = useState<Etapa>("selecionar");

  const [posts, setPosts] = useState<PostSimples[]>([]);
  const [carregandoPosts, setCarregandoPosts] = useState(false);
  const [postSelecionado, setPostSelecionado] = useState<PostSimples | null>(null);

  const [reflexoes, setReflexoes] = useState<ReflexaoGerada[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [slugsSalvos, setSlugsSalvos] = useState<string[]>([]);

  // Fecha com Escape
  useEffect(() => {
    if (!aberto) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") fechar(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [aberto]);

  // Bloqueia scroll do body
  useEffect(() => {
    document.body.style.overflow = aberto ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [aberto]);

  // Carrega publicações do autor ao abrir
  useEffect(() => {
    if (!aberto) return;
    async function carregar() {
      setCarregandoPosts(true);
      try {
        const q = query(
          collection(db, "posts"),
          where("autorId", "==", autorId),
          where("tipo", "in", ["sermao", "artigo"]),
          orderBy("data", "desc")
        );
        const snap = await getDocs(q);
        setPosts(snap.docs.map((d) => ({
          id: d.id,
          titulo: d.data().titulo ?? "Sem título",
          tipo: d.data().tipo,
          slug: d.data().slug,
        })));
      } catch {
        setErro("Não foi possível carregar suas publicações.");
      }
      setCarregandoPosts(false);
    }
    carregar();
  }, [aberto, autorId]);

  function fechar() {
    setAberto(false);
    setTimeout(() => {
      setEtapa("selecionar");
      setPostSelecionado(null);
      setReflexoes([]);
      setErro(null);
      setSlugsSalvos([]);
    }, 250);
  }

  async function handleGerar() {
    if (!postSelecionado) return;
    setEtapa("gerando");
    setErro(null);
    try {
      const res = await fetch("/api/reflexoes/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: postSelecionado.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro ?? "Erro ao gerar reflexões.");
      setReflexoes(data.reflexoes);
      setEtapa("revisar");
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : "Erro desconhecido.");
      setEtapa("selecionar");
    }
  }

  async function handleSalvar() {
    if (!postSelecionado) return;
    setEtapa("salvando");
    setErro(null);
    try {
      const res = await fetch("/api/reflexoes/salvar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reflexoes,
          autorId,
          autorNome,
          autorSlug,
          publicacaoOrigemId: postSelecionado.id,
          publicacaoOrigemSlug: postSelecionado.slug,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro ?? "Erro ao salvar.");
      setSlugsSalvos(data.slugs);
      setEtapa("concluido");
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : "Erro desconhecido.");
      setEtapa("revisar");
    }
  }

  // ── Render ──────────────────────────────────────────────────
  return (
    <>
      {/* Botão de abertura */}
      <button
        type="button"
        onClick={() => setAberto(true)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "9px 16px",
          borderRadius: "var(--radius-md)",
          background: "var(--emerald-dim)",
          border: "1px solid var(--emerald)",
          color: "var(--emerald)",
          fontSize: "0.85rem",
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "inherit",
          transition: "background 0.18s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--emerald)"; e.currentTarget.style.color = "#fff"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "var(--emerald-dim)"; e.currentTarget.style.color = "var(--emerald)"; }}
      >
        <IconSparkle size={15} />
        Criar Reflexões
      </button>

      {/* Overlay */}
      {aberto && (
        <div
          onClick={fechar}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          {/* Modal */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-xl)",
              width: "100%",
              maxWidth: 560,
              maxHeight: "90vh",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
              padding: "1.75rem",
              position: "relative",
            }}
          >
            {/* Cabeçalho */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
              <div>
                <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text-1)", margin: 0 }}>
                  Criar Reflexões
                </h2>
                <p style={{ fontSize: "0.8rem", color: "var(--text-3)", margin: "0.25rem 0 0" }}>
                  Selecione uma publicação e a IA gerará 3 reflexões para o WhatsApp.
                </p>
              </div>
              <button
                type="button"
                onClick={fechar}
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-light)",
                  borderRadius: "var(--radius-md)",
                  color: "var(--text-3)",
                  cursor: "pointer",
                  padding: "6px",
                  display: "flex",
                  flexShrink: 0,
                }}
              >
                <IconX size={14} />
              </button>
            </div>

            {/* Erro */}
            {erro && (
              <div style={{
                padding: "0.75rem 1rem",
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.25)",
                borderRadius: "var(--radius-md)",
                color: "#f87171",
                fontSize: "0.82rem",
              }}>
                {erro}
              </div>
            )}

            {/* ── Etapa: selecionar ── */}
            {etapa === "selecionar" && (
              <>
                {carregandoPosts ? (
                  <p style={{ color: "var(--text-3)", fontSize: "0.85rem" }}>Carregando publicações...</p>
                ) : posts.length === 0 ? (
                  <p style={{ color: "var(--text-3)", fontSize: "0.85rem" }}>Nenhuma publicação encontrada.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {posts.map((post) => (
                      <button
                        key={post.id}
                        type="button"
                        onClick={() => setPostSelecionado(post)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.75rem",
                          padding: "0.875rem 1rem",
                          borderRadius: "var(--radius-md)",
                          background: postSelecionado?.id === post.id ? "var(--emerald-dim)" : "var(--bg-elevated)",
                          border: `1px solid ${postSelecionado?.id === post.id ? "var(--emerald)" : "var(--border-light)"}`,
                          color: "var(--text-1)",
                          cursor: "pointer",
                          textAlign: "left",
                          fontFamily: "inherit",
                          transition: "all 0.15s",
                        }}
                      >
                        <span style={{
                          fontSize: "0.62rem",
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: post.tipo === "sermao" ? "var(--emerald)" : "var(--text-3)",
                          background: "var(--bg-card)",
                          padding: "2px 7px",
                          borderRadius: "var(--radius-full)",
                          flexShrink: 0,
                        }}>
                          {post.tipo}
                        </span>
                        <span style={{ fontSize: "0.875rem", fontWeight: 600, flex: 1 }}>
                          {post.titulo}
                        </span>
                        {postSelecionado?.id === post.id && (
                          <span style={{ color: "var(--emerald)", fontSize: "1rem", flexShrink: 0 }}>✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleGerar}
                  disabled={!postSelecionado}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                    padding: "11px 20px",
                    borderRadius: "var(--radius-md)",
                    background: postSelecionado ? "var(--emerald)" : "var(--bg-elevated)",
                    border: "none",
                    color: postSelecionado ? "#fff" : "var(--text-3)",
                    fontSize: "0.9rem",
                    fontWeight: 700,
                    cursor: postSelecionado ? "pointer" : "not-allowed",
                    fontFamily: "inherit",
                    transition: "background 0.18s",
                    marginTop: "0.25rem",
                  }}
                >
                  <IconSparkle size={15} />
                  Gerar Reflexões com IA
                </button>
              </>
            )}

            {/* ── Etapa: gerando ── */}
            {etapa === "gerando" && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", padding: "2rem 0" }}>
                <div className="btn-spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
                <p style={{ color: "var(--text-2)", fontSize: "0.9rem", textAlign: "center" }}>
                  Gerando reflexões a partir de <strong>"{postSelecionado?.titulo}"</strong>...
                </p>
                <p style={{ color: "var(--text-3)", fontSize: "0.78rem", textAlign: "center" }}>
                  Isso pode levar alguns segundos.
                </p>
              </div>
            )}

            {/* ── Etapa: revisar ── */}
            {etapa === "revisar" && reflexoes.length > 0 && (
              <>
                <p style={{ fontSize: "0.8rem", color: "var(--text-3)", margin: 0 }}>
                  Revise as reflexões geradas antes de publicar.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {reflexoes.map((r, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "1rem 1.125rem",
                        borderRadius: "var(--radius-md)",
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border-light)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.5rem",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{
                          fontSize: "0.62rem",
                          fontWeight: 700,
                          color: "var(--emerald)",
                          background: "var(--emerald-dim)",
                          padding: "2px 8px",
                          borderRadius: "var(--radius-full)",
                          letterSpacing: "0.06em",
                        }}>
                          Reflexão {i + 1}
                        </span>
                      </div>
                      <p style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-1)", margin: 0 }}>
                        {r.titulo}
                      </p>
                      <p style={{ fontSize: "0.78rem", color: "var(--text-2)", margin: 0, lineHeight: 1.5 }}>
                        {r.conteudo.slice(0, 180)}…
                      </p>
                      <p style={{ fontSize: "0.73rem", color: "var(--emerald)", fontStyle: "italic", margin: 0 }}>
                        "{r.fraseInstigadora}"
                      </p>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: "0.625rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={handleSalvar}
                    style={{
                      flex: 1,
                      padding: "11px 20px",
                      borderRadius: "var(--radius-md)",
                      background: "var(--emerald)",
                      border: "none",
                      color: "#fff",
                      fontSize: "0.9rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Publicar as 3 Reflexões
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEtapa("selecionar"); setReflexoes([]); }}
                    style={{
                      padding: "11px 16px",
                      borderRadius: "var(--radius-md)",
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border-light)",
                      color: "var(--text-2)",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Voltar
                  </button>
                </div>
              </>
            )}

            {/* ── Etapa: salvando ── */}
            {etapa === "salvando" && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", padding: "2rem 0" }}>
                <div className="btn-spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
                <p style={{ color: "var(--text-2)", fontSize: "0.9rem" }}>Publicando reflexões...</p>
              </div>
            )}

            {/* ── Etapa: concluído ── */}
            {etapa === "concluido" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", alignItems: "center", padding: "1rem 0" }}>
                <div style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "var(--emerald-dim)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.5rem",
                }}>
                  ✓
                </div>
                <p style={{ fontWeight: 700, color: "var(--text-1)", fontSize: "1rem", margin: 0 }}>
                  Reflexões publicadas!
                </p>
                <p style={{ color: "var(--text-3)", fontSize: "0.8rem", textAlign: "center", margin: 0 }}>
                  As 3 reflexões já aparecem na aba "Reflexões" do seu perfil.
                </p>
                {slugsSalvos.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", width: "100%" }}>
                    {slugsSalvos.map((slug, i) => (
                      <a
                        key={slug}
                        href={`/${autorSlug}/reflexao/${slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: "0.8rem",
                          color: "var(--emerald)",
                          textDecoration: "none",
                          padding: "6px 10px",
                          background: "var(--bg-elevated)",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--border-light)",
                        }}
                      >
                        → Ver Reflexão {i + 1}
                      </a>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={fechar}
                  style={{
                    padding: "10px 24px",
                    borderRadius: "var(--radius-md)",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-light)",
                    color: "var(--text-2)",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    marginTop: "0.25rem",
                  }}
                >
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}