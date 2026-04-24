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

  // 🔐 LOGIN NORMAL
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

  // 🔥 LOGIN COM GOOGLE
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
    <div className="min-h-screen flex items-center justify-center bg-neutral-900 px-4">
      <form
        onSubmit={handleLogin}
        className="bg-neutral-800 p-6 rounded-lg w-full max-w-sm space-y-5 border border-neutral-700"
      >
        <h1 className="text-2xl font-semibold text-center text-emerald-300">
          Entrar
        </h1>

        {/* EMAIL */}
        <input
          type="email"
          placeholder="Email"
          className="w-full p-2 rounded bg-neutral-900 border border-neutral-700 text-neutral-100"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {/* SENHA */}
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Senha"
            className="w-full p-2 pr-10 rounded bg-neutral-900 border border-neutral-700 text-neutral-100"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-2 text-neutral-400"
          >
            {showPassword ? "🙈" : "👁"}
          </button>
        </div>

        {/* ERRO */}
        {error && (
          <div className="space-y-2 text-center">
            <p className="text-red-400 text-sm">{error}</p>

            {userNotFound && (
              <Link
                href={`/cadastro?email=${email}`}
                className="text-sm text-blue-400 underline"
              >
                Criar conta
              </Link>
            )}
          </div>
        )}

        {/* BOTÃO LOGIN */}
        <button
          type="submit"
          disabled={loading}
          className="
            w-full py-2 rounded text-white
            bg-emerald-600
            hover:bg-emerald-700
            active:scale-95
            transition
            shadow-md
            cursor-pointer
            disabled:opacity-50
          "
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>

        {/* 🔥 GOOGLE (AGORA PADRÃO VISUAL) */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="
            w-full py-2 rounded text-white
            bg-emerald-600
            hover:bg-emerald-700
            active:scale-95
            transition
            shadow-md
            cursor-pointer
            border border-emerald-400/30
            disabled:opacity-50
          "
        >
          Entrar com Google
        </button>

        {/* LINKS */}
        <div className="flex justify-between text-sm">
          <Link
            href="/esqueci-senha"
            className="text-blue-400 hover:text-blue-300 underline"
          >
            Esqueci a senha
          </Link>

          <Link
            href="/cadastro"
            className="text-blue-400 hover:text-blue-300 underline"
          >
            Criar conta
          </Link>
        </div>
      </form>
    </div>
  );
}