"use client";

import { useState } from "react";
import Input from "@/components/Input";
import Button from "@/components/Button";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function Cadastro() {
  const [nome, setNome] = useState("");
  const [titulo, setTitulo] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  const router = useRouter();

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault();

    if (senha.length < 6) {
      alert("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        senha
      );

      const user = userCredential.user;

      // 🗄️ salva no Firestore (PADRÃO LIMPO)
      await setDoc(doc(db, "users", user.uid), {
        nome,
        titulo,
        email,
        criadoEm: new Date(),
      });

      router.push("/posts");

      console.log("Usuário criado com perfil");
    } catch (error) {
      console.error("Erro ao cadastrar:", error);
      alert("Erro ao criar conta");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Cadastro</h1>

      <form onSubmit={handleCadastro} className="space-y-4">

        {/* TÍTULO */}
        <div>
          <label className="block text-sm mb-1">Título</label>

          <input
            list="titulos"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="w-full border p-2 rounded"
            placeholder="Ex: Pr., Pastor, Padre..."
          />

          <datalist id="titulos">
            <option value="Pr." />
            <option value="Rev." />
            <option value="Pastor" />
            <option value="Reverendo" />
            <option value="Diácono" />
            <option value="Presbítero" />
            <option value="Padre" />
            <option value="Irmão" />
            <option value="Irmã" />
            <option value="Seminarista" />
            <option value="Missionário" />
            <option value="Missionária" />
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

        <Button variant="secondary">
          Criar conta
        </Button>
      </form>
    </div>
  );
}