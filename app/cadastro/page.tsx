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
    <div className="max-w-sm mx-auto p-6 space-y-6">

      <h1 className="text-2xl font-bold">
        Cadastro
      </h1>

      <form onSubmit={handleCadastro} className="space-y-4">

        {/* TÍTULO */}
        <div>
          <label className="block text-sm mb-1">Título (opcional)</label>

          <input
            list="titulos"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="w-full border p-2 rounded"
            placeholder="Ex: Pr., Pastor, Missionário..."
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

        {error && (
          <p className="text-red-600 text-sm">
            {error}
          </p>
        )}

        {/* 🔥 CORREÇÃO CRÍTICA */}
        <Button
          type="submit"
          variant="secondary"
          disabled={loading}
        >
          {loading ? "Criando conta..." : "Criar conta"}
        </Button>

      </form>
    </div>
  );
}