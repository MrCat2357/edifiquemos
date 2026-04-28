"use client";

import { useState, Suspense } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function EsqueciSenhaForm() {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") || "";

  const [email, setEmail] = useState(emailParam);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();

    setMensagem("");
    setErro("");
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setMensagem("Email de recuperação enviado! Verifique sua caixa de entrada.");
    } catch (error: any) {
      console.error(error);

      if (error.code === "auth/user-not-found") {
        setErro("Esse email não está cadastrado.");
      } else if (error.code === "auth/invalid-email") {
        setErro("Email inválido.");
      } else {
        setErro("Erro ao enviar email. Tente novamente.");
      }
    }

    setLoading(false);
  }

  return (
    <div className="auth-card">

      {/* Logo */}
      <div className="auth-logo">
        <span className="auth-logo-dot" />
        Voz da Fé
      </div>

      <h1 className="auth-title">Recuperar senha</h1>
      <p className="auth-subtitle">
        Informe seu e-mail e enviaremos um link para redefinir sua senha.
      </p>

      <form onSubmit={handleReset} className="auth-form">

        <div className="auth-field">
          <label className="auth-label">E-mail</label>
          <input
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="auth-input"
          />
        </div>

        {/* Mensagem de sucesso */}
        {mensagem && (
          <div style={{
            background: "rgba(16,185,129,0.08)",
            border: "1px solid rgba(16,185,129,0.2)",
            borderRadius: "var(--radius-sm)",
            padding: "0.625rem 0.875rem",
          }}>
            <p style={{ fontSize: "0.82rem", color: "var(--emerald)" }}>{mensagem}</p>
          </div>
        )}

        {/* Erro */}
        {erro && (
          <div className="auth-error">
            <p>{erro}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="auth-btn-primary"
        >
          {loading ? "Enviando..." : "Enviar email de recuperação"}
        </button>

      </form>

      <div className="auth-links">
        <Link href="/login" className="auth-link">← Voltar para o login</Link>
      </div>

    </div>
  );
}

export default function EsqueciSenha() {
  return (
    <div className="auth-page">
      <Suspense fallback={
        <div className="loading-state">
          <div className="spinner" />
          <span>Carregando...</span>
        </div>
      }>
        <EsqueciSenhaForm />
      </Suspense>
    </div>
  );
}