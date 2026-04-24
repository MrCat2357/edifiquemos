"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  signInWithEmailAndPassword,
  fetchSignInMethodsForEmail,
} from "firebase/auth";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
      const methods = await fetchSignInMethodsForEmail(auth, email);

      if (methods.length === 0) {
        setError("Usuário não cadastrado.");
        setUserNotFound(true);
        setLoading(false);
        return;
      }

      await signInWithEmailAndPassword(auth, email, password);

      setAttempts(0);
      router.push("/");
    } catch (err: any) {
      if (err.code === "auth/wrong-password") {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);

        if (newAttempts >= 3) {
          setError("Muitas tentativas. Tente novamente mais tarde.");
        } else {
          setError(`Senha incorreta. Tentativa ${newAttempts} de 3.`);
        }
      } else {
        setError("Erro ao fazer login.");
      }
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-900 px-4">
      <form
        onSubmit={handleLogin}
        className="bg-neutral-800 p-6 rounded-lg w-full max-w-sm space-y-5 border border-neutral-700"
      >
        {/* TÍTULO */}
        <h1 className="text-2xl font-semibold text-center text-emerald-300">
          Entrar
        </h1>

        {/* EMAIL */}
        <input
          type="email"
          placeholder="Email"
          className="w-full p-2 rounded bg-neutral-900 border border-neutral-700 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {/* SENHA */}
        <input
          type="password"
          placeholder="Senha"
          className="w-full p-2 rounded bg-neutral-900 border border-neutral-700 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {/* ERROS */}
        {error && (
          <div className="space-y-2 text-center">
            <p className="text-red-400 text-sm">{error}</p>

            {userNotFound && (
              <button
                type="button"
                onClick={() => router.push(`/cadastro?email=${email}`)}
                className="text-sm text-blue-400 underline hover:text-blue-300"
              >
                Criar conta
              </button>
            )}
          </div>
        )}

        {/* BOTÃO ENTRAR */}
        <button
          type="submit"
          disabled={loading}
          className="
            w-full py-2 rounded text-white
            bg-emerald-600
            hover:bg-emerald-700
            active:scale-95
            active:translate-y-0.5
            transition
            shadow-md
            cursor-pointer
            disabled:opacity-50
          "
        >
          {loading ? "Entrando..." : "Entrar"}
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