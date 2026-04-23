"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

import {
  signInWithEmailAndPassword,
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
      // 🔐 TENTA LOGIN DIRETO (forma correta com Firebase)
      await signInWithEmailAndPassword(auth, email, password);

      // ✔ sucesso
      setAttempts(0);
      setUserNotFound(false);

      router.push("/");

    } catch (err: any) {
  console.log(err.code);

  // 🔴 senha errada ou login inválido
  if (
    err.code === "auth/wrong-password"
  ) {
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    if (newAttempts >= 3) {
      setError("Muitas tentativas. Tente novamente mais tarde.");
    } else {
      setError(`Senha incorreta. Tentativa ${newAttempts} de 3.`);
    }
  }

  // 🔴 usuário não existe (APENAS ESSE CASO REAL)
  else if (err.code === "auth/user-not-found") {
    setError("Usuário não cadastrado.");
    setUserNotFound(true);
  }

  // 🔴 fallback REAL (importante!)
  else if (err.code === "auth/invalid-credential") {
    setError("Email ou senha incorretos.");
  }

  else {
    setError("Erro ao fazer login. Tente novamente.");
  }
}

    setLoading(false);
  }

  return (
    <div className="max-w-sm mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Login</h1>

      <form onSubmit={handleLogin} className="space-y-4">
        <input
          type="email"
          placeholder="Email"
          className="w-full border p-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Senha"
          className="w-full border p-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {/* 🔴 ERRO + BOTÃO DE CADASTRO */}
        {error && (
          <div className="space-y-2">
            <p className="text-red-500 text-sm">{error}</p>

            {userNotFound && (
              <button
                type="button"
                onClick={() =>
                  router.push(`/cadastro?email=${email}`)
                }
                className="text-sm text-blue-600 underline"
              >
                Criar conta
              </button>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-black text-white p-2"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
        <div className="text-right text-sm">
  <button
    type="button"
    onClick={() =>
      router.push(`/esqueci-senha?email=${email}`)
    }
    className="text-blue-600 hover:underline"
  >
    Esqueci minha senha
  </button>
</div>
      </form>
    </div>
  );
}