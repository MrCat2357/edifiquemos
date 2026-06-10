"use client";

/**
 * app/admin/tts/TTSAdminClient.tsx
 *
 * Componente client do painel admin TTS.
 * - Verifica Firebase Auth + UID ao montar (proteção client complementar à server)
 * - Busca métricas via Server Action (TTS_ADMIN_SECRET nunca exposto no bundle)
 * - Ações PATCH autenticadas com Bearer token Firebase Auth
 * - Export CSV via Server Action
 * - Estilo: exclusivamente CSS variables do projeto
 */

import { useEffect, useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type PostComErro = {
  postId: string;
  tipo: string;
  audioErrorCount: number;
  titulo: string;
};

type PostStuck = {
  postId: string;
  tipo: string;
  audioUpdatedAt: { seconds: number; nanoseconds: number } | null;
};

type PostInvalidado = {
  postId: string;
  tipo: string;
  titulo: string;
};

type Metricas = {
  totalGeracoes: number;
  custoTotalUSD: number;
  custoMesAtualUSD: number;
  storageR2GB: number;
  postsComErro: PostComErro[];
  postsStuck: PostStuck[];
  postsInvalidados: PostInvalidado[];
};

type Props = {
  fetchMetricas: () => Promise<Metricas>;
  fetchCsvMes: () => Promise<string>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatarData(ts: { seconds: number } | null): string {
  if (!ts) return "—";
  return new Date(ts.seconds * 1000).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatarUSD(valor: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", minimumFractionDigits: 6,
  }).format(valor);
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function TTSAdminClient({ fetchMetricas, fetchCsvMes }: Props) {
  const router = useRouter();

  const [verificando, setVerificando]   = useState(true);
  const [autorizado, setAutorizado]     = useState(false);
  const [metricas, setMetricas]         = useState<Metricas | null>(null);
  const [carregando, setCarregando]     = useState(false);
  const [erro, setErro]                 = useState<string | null>(null);
  const [feedbacks, setFeedbacks]       = useState<Record<string, string>>({});
  const [isPending, startTransition]    = useTransition();

  // ── Verificação de autorização client-side (complementar à server) ────────
  useEffect(() => {
    const verificar = async () => {
      try {
        // Aguarda o Firebase Auth inicializar
        await new Promise<void>((resolve) => {
          const unsubscribe = auth.onAuthStateChanged((user) => {
            unsubscribe();
            resolve();
          });
        });

        const user = auth.currentUser;
        if (!user) {
          router.replace("/");
          return;
        }

        // Verifica se o UID está na lista de admins via token claims ou
        // comparando com o padrão do projeto (verificação no servidor via PATCH)
        // Aqui fazemos uma chamada leve ao PATCH para confirmar autorização
        const token = await user.getIdToken();
        // Teste de autorização: tentamos uma chamada PATCH com body inválido
        // Um 403 significa não autorizado; 400 (body inválido) significa autorizado
        const res = await fetch("/api/tts/gerar", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({}), // body propositalmente inválido → 400 se autorizado, 403 se não
        });

        if (res.status === 403 || res.status === 401) {
          router.replace("/");
          return;
        }

        setAutorizado(true);
      } catch {
        router.replace("/");
      } finally {
        setVerificando(false);
      }
    };

    verificar();
  }, [router]);

  // ── Carregar métricas ─────────────────────────────────────────────────────
  const carregarMetricas = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const dados = await fetchMetricas();
      setMetricas(dados);
    } catch (e) {
      setErro("Erro ao carregar métricas. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }, [fetchMetricas]);

  useEffect(() => {
    if (autorizado) carregarMetricas();
  }, [autorizado, carregarMetricas]);

  // ── Ação PATCH autenticada ────────────────────────────────────────────────
  const executarAcao = useCallback(
    async (postId: string, action: "reset" | "reset_errors", label: string) => {
      const chave = `${postId}:${action}`;
      setFeedbacks((prev) => ({ ...prev, [chave]: "Processando…" }));

      try {
        const user = auth.currentUser;
        if (!user) throw new Error("Não autenticado.");
        const token = await user.getIdToken();

        const res = await fetch("/api/tts/gerar", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ postId, action }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error ?? `HTTP ${res.status}`);
        }

        setFeedbacks((prev) => ({ ...prev, [chave]: `✓ ${label}` }));
        // Recarrega métricas após ação bem-sucedida
        setTimeout(() => carregarMetricas(), 800);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Erro desconhecido";
        setFeedbacks((prev) => ({ ...prev, [chave]: `✗ ${msg}` }));
      }

      // Limpa o feedback após 4s
      setTimeout(() => {
        setFeedbacks((prev) => {
          const copia = { ...prev };
          delete copia[chave];
          return copia;
        });
      }, 4000);
    },
    [carregarMetricas]
  );

  // ── Export CSV ────────────────────────────────────────────────────────────
  const exportarCsv = useCallback(async () => {
    try {
      const csv = await fetchCsvMes();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      const mes  = new Date().toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" }).replace("/", "-");
      a.href     = url;
      a.download = `tts_logs_${mes}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Erro ao exportar CSV. Tente novamente.");
    }
  }, [fetchCsvMes]);

  // ── Estados de carregamento / verificação ─────────────────────────────────
  if (verificando) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-base, #0f0f0f)",
        color: "var(--text-3, #6b7280)",
        fontFamily: "sans-serif",
      }}>
        Verificando acesso…
      </div>
    );
  }

  if (!autorizado) return null;

  // ── UI principal ──────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-base, #0f0f0f)",
      color: "var(--text-1, #f9fafb)",
      fontFamily: "sans-serif",
      padding: "2rem",
      maxWidth: "1100px",
      margin: "0 auto",
    }}>

      {/* Cabeçalho */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "2rem",
        borderBottom: "1px solid var(--border, #1f2937)",
        paddingBottom: "1rem",
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "var(--text-1, #f9fafb)" }}>
            TTS Admin
          </h1>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.85rem", color: "var(--text-3, #6b7280)" }}>
            Painel administrativo do sistema de Text-to-Speech
          </p>
        </div>
        <button
          onClick={carregarMetricas}
          disabled={carregando}
          style={btnStyle("secondary", carregando)}
        >
          {carregando ? "Atualizando…" : "↻ Atualizar"}
        </button>
      </div>

      {/* Erro global */}
      {erro && (
        <div style={{
          background: "#3f0e0e",
          border: "1px solid #7f1d1d",
          borderRadius: "var(--radius-lg, 0.75rem)",
          padding: "1rem",
          marginBottom: "1.5rem",
          color: "#fca5a5",
          fontSize: "0.9rem",
        }}>
          {erro}
        </div>
      )}

      {/* ── Seção 1: Cards de métricas ─────────────────────────────────── */}
      <Section titulo="Métricas">
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
        }}>
          <MetricaCard
            label="Gerações totais"
            valor={metricas ? String(metricas.totalGeracoes) : "—"}
            carregando={carregando}
          />
          <MetricaCard
            label="Custo total"
            valor={metricas ? formatarUSD(metricas.custoTotalUSD) : "—"}
            carregando={carregando}
          />
          <MetricaCard
            label="Custo este mês"
            valor={metricas ? formatarUSD(metricas.custoMesAtualUSD) : "—"}
            carregando={carregando}
          />
          <MetricaCard
            label="Estimativa R2"
            valor={metricas ? `${metricas.storageR2GB.toFixed(3)} GB` : "—"}
            carregando={carregando}
          />
        </div>
      </Section>

      {/* ── Seção 2: Posts com erro ──────────────────────────────────────── */}
      <Section titulo={`Posts com erro (${metricas?.postsComErro.length ?? 0})`}>
        {!metricas || metricas.postsComErro.length === 0 ? (
          <Vazio texto="Nenhum post com erro." />
        ) : (
          <Tabela
            cabecalhos={["Título", "Tipo", "Erros consecutivos", "Ações"]}
          >
            {metricas.postsComErro.map((p) => (
              <tr key={p.postId}>
                <td style={tdStyle}>{p.titulo || p.postId}</td>
                <td style={{ ...tdStyle, color: "var(--text-3, #6b7280)" }}>{p.tipo}</td>
                <td style={{ ...tdStyle, color: p.audioErrorCount >= 3 ? "#f87171" : "var(--text-1, #f9fafb)" }}>
                  {p.audioErrorCount}
                </td>
                <td style={{ ...tdStyle, display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <BotaoAcao
                    label="Tentar novamente"
                    feedback={feedbacks[`${p.postId}:reset_errors`]}
                    onClick={() => executarAcao(p.postId, "reset_errors", "Erros zerados")}
                  />
                  <BotaoAcao
                    label="Resetar tudo"
                    feedback={feedbacks[`${p.postId}:reset`]}
                    onClick={() => executarAcao(p.postId, "reset", "Resetado")}
                    danger
                  />
                </td>
              </tr>
            ))}
          </Tabela>
        )}
      </Section>

      {/* ── Seção 3: Posts travados em "generating" ──────────────────────── */}
      <Section titulo={`Posts travados em geração (${metricas?.postsStuck.length ?? 0})`}>
        {!metricas || metricas.postsStuck.length === 0 ? (
          <Vazio texto="Nenhum post travado." />
        ) : (
          <Tabela cabecalhos={["Post ID", "Tipo", "Travado desde", "Ações"]}>
            {metricas.postsStuck.map((p) => (
              <tr key={p.postId}>
                <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: "0.8rem", color: "var(--text-3, #6b7280)" }}>
                  {p.postId}
                </td>
                <td style={{ ...tdStyle, color: "var(--text-3, #6b7280)" }}>{p.tipo}</td>
                <td style={{ ...tdStyle, color: "#fbbf24" }}>
                  {formatarData(p.audioUpdatedAt)}
                </td>
                <td style={tdStyle}>
                  <BotaoAcao
                    label="Liberar"
                    feedback={feedbacks[`${p.postId}:reset`]}
                    onClick={() => executarAcao(p.postId, "reset", "Liberado")}
                  />
                </td>
              </tr>
            ))}
          </Tabela>
        )}
      </Section>

      {/* ── Seção 4: Posts aguardando regeneração ────────────────────────── */}
      <Section titulo={`Aguardando regeneração (${metricas?.postsInvalidados.length ?? 0})`}>
        <p style={{
          fontSize: "0.85rem",
          color: "var(--text-3, #6b7280)",
          marginBottom: "1rem",
          marginTop: 0,
        }}>
          Estes posts tiveram o conteúdo editado. O novo áudio será gerado automaticamente quando alguém clicar em Ouvir.
        </p>
        {!metricas || metricas.postsInvalidados.length === 0 ? (
          <Vazio texto="Nenhum post aguardando regeneração." />
        ) : (
          <Tabela cabecalhos={["Título", "Tipo"]}>
            {metricas.postsInvalidados.map((p) => (
              <tr key={p.postId}>
                <td style={tdStyle}>{p.titulo || p.postId}</td>
                <td style={{ ...tdStyle, color: "var(--text-3, #6b7280)" }}>{p.tipo}</td>
              </tr>
            ))}
          </Tabela>
        )}
      </Section>

      {/* ── Seção 5: Export CSV ──────────────────────────────────────────── */}
      <Section titulo="Exportar logs do mês">
        <p style={{
          fontSize: "0.85rem",
          color: "var(--text-3, #6b7280)",
          marginBottom: "1rem",
          marginTop: 0,
        }}>
          Baixa os registros de geração de áudio do mês atual em formato CSV.
          Colunas: postId, tipo, charCount, estimatedCostUSD, storage, evento, createdAt.
        </p>
        <button onClick={exportarCsv} style={btnStyle("primary", false)}>
          ⬇ Exportar CSV do mês
        </button>
      </Section>

    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-componentes internos
// ---------------------------------------------------------------------------

function Section({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section style={{
      background: "var(--bg-elevated, #1a1a1a)",
      border: "1px solid var(--border, #1f2937)",
      borderRadius: "var(--radius-lg, 0.75rem)",
      padding: "1.5rem",
      marginBottom: "1.5rem",
    }}>
      <h2 style={{
        margin: "0 0 1.25rem",
        fontSize: "1rem",
        fontWeight: 600,
        color: "var(--text-1, #f9fafb)",
        borderBottom: "1px solid var(--border, #1f2937)",
        paddingBottom: "0.75rem",
      }}>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function MetricaCard({
  label,
  valor,
  carregando,
}: {
  label: string;
  valor: string;
  carregando: boolean;
}) {
  return (
    <div style={{
      background: "var(--bg-base, #0f0f0f)",
      border: "1px solid var(--border, #1f2937)",
      borderRadius: "var(--radius-lg, 0.75rem)",
      padding: "1.25rem",
    }}>
      <p style={{ margin: "0 0 0.5rem", fontSize: "0.8rem", color: "var(--text-3, #6b7280)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </p>
      <p style={{
        margin: 0,
        fontSize: "1.4rem",
        fontWeight: 700,
        color: carregando ? "var(--text-3, #6b7280)" : "var(--emerald, #10b981)",
        fontVariantNumeric: "tabular-nums",
      }}>
        {carregando ? "…" : valor}
      </p>
    </div>
  );
}

function Tabela({ cabecalhos, children }: { cabecalhos: string[]; children: React.ReactNode }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
        <thead>
          <tr>
            {cabecalhos.map((h) => (
              <th key={h} style={{
                textAlign: "left",
                padding: "0.5rem 0.75rem",
                color: "var(--text-3, #6b7280)",
                fontWeight: 500,
                borderBottom: "1px solid var(--border, #1f2937)",
                whiteSpace: "nowrap",
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

const tdStyle: React.CSSProperties = {
  padding: "0.75rem",
  borderBottom: "1px solid var(--border, #1f2937)",
  verticalAlign: "middle",
};

function Vazio({ texto }: { texto: string }) {
  return (
    <p style={{ color: "var(--text-3, #6b7280)", fontSize: "0.875rem", margin: 0 }}>
      {texto}
    </p>
  );
}

function BotaoAcao({
  label,
  feedback,
  onClick,
  danger = false,
}: {
  label: string;
  feedback?: string;
  onClick: () => void;
  danger?: boolean;
}) {
  if (feedback) {
    return (
      <span style={{
        fontSize: "0.8rem",
        color: feedback.startsWith("✓") ? "var(--emerald, #10b981)" : "#f87171",
        fontWeight: 500,
      }}>
        {feedback}
      </span>
    );
  }

  return (
    <button
      onClick={onClick}
      style={{
        padding: "0.35rem 0.75rem",
        borderRadius: "0.375rem",
        border: `1px solid ${danger ? "#7f1d1d" : "var(--border, #1f2937)"}`,
        background: danger ? "#3f0e0e" : "var(--bg-base, #0f0f0f)",
        color: danger ? "#fca5a5" : "var(--text-1, #f9fafb)",
        fontSize: "0.8rem",
        cursor: "pointer",
        fontWeight: 500,
        transition: "opacity 0.15s",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
    >
      {label}
    </button>
  );
}

function btnStyle(variant: "primary" | "secondary", disabled: boolean): React.CSSProperties {
  return {
    padding: "0.5rem 1.25rem",
    borderRadius: "0.5rem",
    border: variant === "primary"
      ? "1px solid var(--emerald, #10b981)"
      : "1px solid var(--border, #1f2937)",
    background: variant === "primary"
      ? "var(--emerald, #10b981)"
      : "var(--bg-base, #0f0f0f)",
    color: variant === "primary" ? "#0f0f0f" : "var(--text-1, #f9fafb)",
    fontSize: "0.875rem",
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    transition: "opacity 0.15s",
  };
}