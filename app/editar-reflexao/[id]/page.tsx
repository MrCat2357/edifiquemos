"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

/* ── Toast ──────────────────────────────────────────── */

function Toast({ msg, visible }: { msg: string; visible: boolean }) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: "1.5rem",
        left: "50%",
        transform: `translateX(-50%) translateY(${visible ? 0 : "12px"})`,
        background: "var(--bg-elevated)",
        border: "1px solid var(--emerald-dim)",
        color: "var(--emerald)",
        fontSize: "0.82rem",
        fontWeight: 600,
        padding: "8px 20px",
        borderRadius: "var(--radius-full)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        opacity: visible ? 1 : 0,
        transition: "all 0.25s ease",
        pointerEvents: "none",
        zIndex: 999,
      }}
    >
      {msg}
    </div>
  );
}

/* ── Campo de formulário ────────────────────────────── */

function Campo({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      <label
        style={{
          fontSize: "0.8rem",
          fontWeight: 700,
          color: "var(--text-2)",
          letterSpacing: "0.02em",
        }}
      >
        {label}
      </label>
      {children}
      {hint && (
        <p style={{ fontSize: "0.72rem", color: "var(--text-3)", margin: 0 }}>
          {hint}
        </p>
      )}
    </div>
  );
}

/* ── EditarReflexao ─────────────────────────────────── */

export default function EditarReflexao() {
  const { id } = useParams();
  const router = useRouter();

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [naoEncontrado, setNaoEncontrado] = useState(false);
  const [semPermissao, setSemPermissao] = useState(false);

  // Campos editáveis
  const [titulo, setTitulo] = useState("");
  const [fraseInstigadora, setFraseInstigadora] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [perguntaReflexiva, setPerguntaReflexiva] = useState("");

  // Toast
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  function showToast(msg: string, duracao = 2200) {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), duracao);
  }

  /* Aguarda o Firebase hidratar a sessão antes de buscar */
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!id) return;

      try {
        // ✅ Coleção correta: "posts" (não "reflexoes")
        const snap = await getDoc(doc(db, "posts", id as string));

        if (!snap.exists() || snap.data()?.tipo !== "reflexao") {
          setNaoEncontrado(true);
          setCarregando(false);
          return;
        }

        const data = snap.data();

        // Verifica propriedade
        if (!user || user.uid !== data.autorId) {
          setSemPermissao(true);
          setCarregando(false);
          return;
        }

        setTitulo(data.titulo ?? "");
        setFraseInstigadora(data.fraseInstigadora ?? "");
        setConteudo(data.conteudo ?? "");
        setPerguntaReflexiva(data.perguntaReflexiva ?? "");
      } catch (err) {
        console.error(err);
        showToast("Erro ao carregar reflexão.");
      }

      setCarregando(false);
    });

    return () => unsubscribe();
  }, [id]);

  /* Salva alterações */
  async function salvar() {
    if (!titulo.trim()) {
      showToast("O título não pode ficar em branco.");
      return;
    }
    if (!fraseInstigadora.trim()) {
      showToast("A frase instigadora não pode ficar em branco.");
      return;
    }
    if (!conteudo.trim()) {
      showToast("O conteúdo não pode ficar em branco.");
      return;
    }
    if (!perguntaReflexiva.trim()) {
      showToast("A pergunta reflexiva não pode ficar em branco.");
      return;
    }

    setSalvando(true);
    try {
      // ✅ Coleção correta: "posts"
      await updateDoc(doc(db, "posts", id as string), {
        titulo: titulo.trim(),
        fraseInstigadora: fraseInstigadora.trim(),
        conteudo: conteudo.trim(),
        perguntaReflexiva: perguntaReflexiva.trim(),
        editadoEm: new Date(),
      });

      // Invalidação de cache de áudio — fire-and-forget, nunca bloqueia o save
      try {
        const token = await auth.currentUser?.getIdToken();
        if (token) {
          fetch("/api/tts/invalidar", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ postId: id, tipo: "reflexao" }),
          }).catch(() => {});
        }
      } catch { /* ignora */ }

      showToast("Reflexão salva com sucesso!");
      setTimeout(() => {
        router.back();
      }, 900);
    } catch (err) {
      console.error(err);
      showToast("Erro ao salvar. Tente novamente.");
    }
    setSalvando(false);
  }

  /* ── Estados de espera / erro ── */

  if (carregando) {
    return (
      <div className="post-detail-loading">
        <div className="spinner" />
        Carregando reflexão...
      </div>
    );
  }

  if (naoEncontrado) {
    return (
      <div className="post-detail-notfound">Reflexão não encontrada.</div>
    );
  }

  if (semPermissao) {
    return (
      <div className="post-detail-notfound">
        Você não tem permissão para editar esta reflexão.
      </div>
    );
  }

  /* ── Formulário ── */

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    color: "var(--text-1)",
    fontSize: "0.9rem",
    padding: "10px 14px",
    outline: "none",
    transition: "border-color 0.15s",
    boxSizing: "border-box",
  };

  const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    resize: "vertical",
    lineHeight: 1.65,
    fontFamily: "inherit",
  };

  return (
    <>
      <Toast msg={toastMsg} visible={toastVisible} />

      <div
        style={{
          maxWidth: 680,
          margin: "0 auto",
          padding: "calc(var(--header-h) + 2rem) 1.25rem 4rem",
          display: "flex",
          flexDirection: "column",
          gap: "2rem",
        }}
      >
        {/* Cabeçalho */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <h1
            style={{
              fontSize: "clamp(1.3rem, 3vw, 1.75rem)",
              fontWeight: 800,
              color: "var(--text-1)",
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            Editar reflexão
          </h1>
          <p style={{ fontSize: "0.82rem", color: "var(--text-3)", margin: 0 }}>
            Ajuste o conteúdo gerado automaticamente conforme necessário.
          </p>
        </div>

        {/* Divider */}
        <div style={{ height: "1px", background: "var(--border)" }} />

        {/* Campos */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

          <Campo label="Título">
            <input
              style={inputStyle}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título da reflexão"
              maxLength={160}
            />
          </Campo>

          <Campo
            label="Frase instigadora"
            hint="Aparece em destaque no topo — deve ser curta e impactante."
          >
            <textarea
              style={{ ...textareaStyle, minHeight: "80px" }}
              value={fraseInstigadora}
              onChange={(e) => setFraseInstigadora(e.target.value)}
              placeholder="Uma frase que sintetiza o tema desta reflexão..."
            />
          </Campo>

          <Campo
            label="Conteúdo"
            hint="Separe os parágrafos com uma linha em branco."
          >
            <textarea
              style={{ ...textareaStyle, minHeight: "260px" }}
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              placeholder="Desenvolvimento da reflexão..."
            />
          </Campo>

          <Campo
            label="Pergunta reflexiva"
            hint="Exibida no box 'Para refletir' ao final."
          >
            <textarea
              style={{ ...textareaStyle, minHeight: "80px" }}
              value={perguntaReflexiva}
              onChange={(e) => setPerguntaReflexiva(e.target.value)}
              placeholder="Uma pergunta que convida o leitor à meditação..."
            />
          </Campo>

        </div>

        {/* Divider */}
        <div style={{ height: "1px", background: "var(--border)" }} />

        {/* Ações */}
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            onClick={salvar}
            disabled={salvando}
            className="auth-btn-primary"
            style={{ flex: 1 }}
          >
            {salvando ? "Salvando..." : "Salvar alterações"}
          </button>
          <button
            onClick={() => router.back()}
            disabled={salvando}
            className="post-btn-delete"
            style={{
              padding: "11px 20px",
              borderRadius: "var(--radius-full)",
              fontSize: "0.85rem",
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </>
  );
}