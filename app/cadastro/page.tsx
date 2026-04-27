"use client";

import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Cadastro() {
  const router = useRouter();

  const [nome, setNome] = useState("");
  const [titulo, setTitulo] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!nome.trim()) { setError("O nome é obrigatório."); return; }
    if (senha.length < 6) { setError("A senha deve ter pelo menos 6 caracteres."); return; }
    if (!aceitouTermos) { setError("Você precisa aceitar os termos de uso."); return; }

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        nome,
        titulo: titulo || "",
        email,
        criadoEm: new Date(),
        aceitouTermos: true,
      });

      const redirect = sessionStorage.getItem("redirect-after-auth");
      if (redirect) {
        sessionStorage.removeItem("redirect-after-auth");
        router.push(redirect);
      } else {
        router.push("/criar-post");
      }
    } catch (error: any) {
      if (error.code === "auth/email-already-in-use") {
        setError("Esse email já está em uso.");
      } else if (error.code === "auth/invalid-email") {
        setError("Email inválido.");
      } else {
        setError("Erro ao criar conta.");
      }
    }

    setLoading(false);
  }

  return (
    <div className="auth-page">
      <div className="auth-card">

        {/* LOGO */}
        <div className="auth-logo">
          <span className="auth-logo-dot" />
          Voz da Fé
        </div>

        <h1 className="auth-title">Criar sua conta</h1>
        <p className="auth-subtitle">Junte-se à comunidade e compartilhe sua fé</p>

        <form onSubmit={handleCadastro} className="auth-form">

          {/* TÍTULO OPCIONAL */}
          <div className="auth-field">
            <label className="auth-label">Título <span className="auth-label-opt">(opcional)</span></label>
            <input
              list="titulos"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="auth-input"
              placeholder="Ex: Pr., Pastor, Rev...."
            />
            <datalist id="titulos">
              <option value="Pr." />
              <option value="Rev." />
              <option value="Pastor" />
              <option value="Missionário" />
              <option value="Irmão" />
              <option value="Irmã" />
            </datalist>
          </div>

          {/* NOME */}
          <div className="auth-field">
            <label className="auth-label">Nome</label>
            <input
              type="text"
              placeholder="Seu nome completo"
              className="auth-input"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>

          {/* EMAIL */}
          <div className="auth-field">
            <label className="auth-label">Email</label>
            <input
              type="email"
              placeholder="seu@email.com"
              className="auth-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {/* SENHA */}
          <div className="auth-field">
            <label className="auth-label">Senha</label>
            <div className="auth-input-wrapper">
              <input
                type={showSenha ? "text" : "password"}
                placeholder="Mínimo 6 caracteres"
                className="auth-input"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowSenha(!showSenha)}
                className="auth-eye-btn"
              >
                {showSenha ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          {/* TERMOS */}
          <label className="auth-terms">
            <input
              type="checkbox"
              checked={aceitouTermos}
              onChange={(e) => setAceitouTermos(e.target.checked)}
              className="auth-checkbox"
            />
            <span>
              Li e aceito os{" "}
              <Link href="/termos" className="auth-link">
                Termos de Uso
              </Link>
            </span>
          </label>

          {/* ERRO */}
          {error && (
            <div className="auth-error">
              <p>{error}</p>
            </div>
          )}

          {/* BOTÃO */}
          <button type="submit" disabled={loading} className="auth-btn-primary">
            {loading ? "Criando conta..." : "Criar conta"}
          </button>

        </form>

        {/* LINK LOGIN */}
        <div className="auth-links">
          <span style={{ color: "var(--text-3)", fontSize: "0.85rem" }}>Já tem uma conta?</span>
          <span className="auth-link-sep">·</span>
          <Link href="/login" className="auth-link">
            Entrar
          </Link>
        </div>

      </div>
    </div>
  );
}
