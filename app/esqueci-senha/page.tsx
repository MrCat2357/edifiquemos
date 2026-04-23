"use client";

import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useSearchParams } from "next/navigation";

export default function EsqueciSenha() {
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

      setMensagem(
        "Email de recuperação enviado! Verifique sua caixa de entrada."
      );
    } catch (error: any) {
      console.error(error);

      if (error.code === "auth/user-not-found") {
        setErro("Esse email não está cadastrado.");
      } else if (error.code === "auth/invalid-email") {
        setErro("Email inválido.");
      } else {
        setErro("Erro ao enviar email.");
      }
    }

    setLoading(false);
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <form onSubmit={handleReset} className="flex flex-col gap-3 w-80">

        <h1 className="text-xl font-bold">
          Recuperar senha
        </h1>

        <input
          type="email"
          placeholder="Digite seu email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border p-2"
        />

        <button
          disabled={loading}
          className="bg-blue-500 text-white p-2 rounded"
        >
          {loading ? "Enviando..." : "Enviar email"}
        </button>

        {mensagem && (
          <p className="text-green-600">{mensagem}</p>
        )}

        {erro && (
          <p className="text-red-600">{erro}</p>
        )}

      </form>
    </div>
  );
}