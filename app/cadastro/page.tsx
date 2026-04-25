"use client";

import { useState } from "react";
import Input from "@/components/Input";
import Button from "@/components/Button";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function Cadastro() {
  const router = useRouter();

  const [nome, setNome] = useState("");
  const [titulo, setTitulo] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault();

    setError("");

    if (!nome.trim()) {
      setError("O nome é obrigatório.");
      return;
    }

    if (senha.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        senha
      );

      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        nome,
        titulo: titulo || "",
        email,
        criadoEm: new Date(),
      });

      const redirect = sessionStorage.getItem("redirect-after-auth");

      if (redirect) {
        sessionStorage.removeItem("redirect-after-auth");
        router.push(redirect);
      } else {
        router.push("/criar-post");
      }

    } catch (error: any) {
      console.log(error.code);

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
    <div className="min-h-screen flex items-center justify-center bg-neutral-900 px-4">

      <form
        onSubmit={handleCadastro}
        className="bg-neutral-800 p-6 rounded-lg w-full max-w-sm space-y-5 border border-neutral-700"
      >
        {/* TÍTULO */}
        <h1 className="text-2xl font-semibold text-center text-emerald-300">
          Cadastro
        </h1>

        {/* TÍTULO OPCIONAL */}
        <div>
          <label className="block text-sm mb-1 text-neutral-300">
            Título (opcional)
          </label>

          <input
            list="titulos"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="w-full p-2 rounded bg-neutral-900 border border-neutral-700 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
            placeholder="Ex: Pr., Pastor..."
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

        {/* INPUTS */}
        <Input
          label="Nome"
          placeholder="Seu nome"
          value={nome}
          onChange={setNome}
        />

        <Input
          label="Email"
          placeholder="Seu email"
          value={email}
          onChange={setEmail}
        />

        <Input
          label="Senha"
          type="password"
          placeholder="Crie uma senha"
          value={senha}
          onChange={setSenha}
        />

        {/* ERRO */}
        {error && (
          <p className="text-red-400 text-sm text-center">
            {error}
          </p>
        )}

        {/* 👆 BOTÃO COM CURSOR DE MÃO GARANTIDO */}
        <div className="cursor-pointer">
          <Button
            type="submit"
            variant="primary"
            disabled={loading}
          >
            {loading ? "Criando conta..." : "Criar conta"}
          </Button>
        </div>

      </form>
    </div>
  );
}