"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";

import { doc, getDoc, setDoc } from "firebase/firestore";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [loading, setLoading] = useState(false);
  const [userNotFound, setUserNotFound] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    if (attempts >= 3) {
      setError("Muitas tentativas. Tente novamente mais tarde.");
      return;
    }

    setLoading(true);
    setError("");
    setUserNotFound(false);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      setAttempts(0);
      router.push("/");
    } catch (err: any) {
      if (err.code === "auth/user-not-found") {
        setError("Usuário não cadastrado.");
        setUserNotFound(true);
      } else if (err.code === "auth/wrong-password") {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        if (newAttempts >= 3) {
          setError("Muitas tentativas. Tente novamente mais tarde.");
        } else {
          setError(`Senha incorreta. Tentativa ${newAttempts} de 3.`);
        }
      } else if (err.code === "auth/invalid-email") {
        setError("Email inválido.");
      } else {
        setError("Erro ao fazer login.");
      }
    }

    setLoading(false);
  }

  async function handleGoogleLogin() {
    setLoading(true);
    setError("");

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          nome: user.displayName || "",
          titulo: "",
          email: user.email,
          criadoEm: new Date(),
        });
      }

      router.push("/");
    } catch (err) {
      console.error(err);
      setError("Erro ao entrar com Google.");
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

        <h1 className="auth-title">Entrar na sua conta</h1>
        <p className="auth-subtitle">Bem-vindo de volta à comunidade</p>

        <form onSubmit={handleLogin} className="auth-form">

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
                type={showPassword ? "text" : "password"}
                placeholder="Sua senha"
                className="auth-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="auth-eye-btn"
              >
                {showPassword ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          {/* ERRO */}
          {error && (
            <div className="auth-error">
              <p>{error}</p>
              {userNotFound && (
                <Link href={`/cadastro?email=${email}`} className="auth-error-link">
                  Criar conta agora →
                </Link>
              )}
            </div>
          )}

          {/* BOTÃO LOGIN */}
          <button type="submit" disabled={loading} className="auth-btn-primary">
            {loading ? "Entrando..." : "Entrar"}
          </button>

          {/* DIVISOR */}
          <div className="auth-divider">
            <span />
            <p>ou continue com</p>
            <span />
          </div>

          {/* GOOGLE */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="auth-btn-google"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Entrar com Google
          </button>

        </form>

        {/* LINKS */}
        <div className="auth-links">
          <Link href="/esqueci-senha" className="auth-link">
            Esqueci a senha
          </Link>
          <span className="auth-link-sep">·</span>
          <Link href="/cadastro" className="auth-link">
            Criar conta
          </Link>
        </div>

      </div>
    </div>
  );
}