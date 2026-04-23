"use client";

import { useState, useEffect } from "react";
import Input from "@/components/Input";
import Button from "@/components/Button";

import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";

import { auth, db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  const router = useRouter();
  const { user, loading } = useAuth();

  // 🔒 Se já estiver logado, redireciona
  useEffect(() => {
    if (!loading && user) {
      router.push("/posts");
    }
  }, [user, loading, router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    try {
      await signInWithEmailAndPassword(auth, email, senha);

      router.push("/posts");
    } catch (error) {
      console.error("Erro ao logar:", error);
      alert("Email ou senha inválidos");
    }
  }

  async function handleGoogleLogin() {
    const provider = new GoogleAuthProvider();

    try {
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;

      // 🗄️ SALVA NO FIRESTORE
      await setDoc(doc(db, "users", user.uid), {
        nome: user.displayName || "Usuário",
        email: user.email,
        foto: user.photoURL || "",
        criadoEm: new Date(),
      });

      router.push("/posts");
    } catch (error) {
      console.error("Erro Google:", error);
      alert("Erro ao entrar com Google");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Login</h1>

      <form onSubmit={handleLogin} className="space-y-4">
        <Input
          label="Email"
          placeholder="Digite seu email"
          value={email}
          onChange={setEmail}
        />

        <Input
          label="Senha"
          type="password"
          placeholder="Digite sua senha"
          value={senha}
          onChange={setSenha}
        />

        <Button>Entrar</Button>

        <a href="/esqueci-senha" className="text-sm text-blue-500">
          Esqueci minha senha
        </a>
      </form>

      <button
        onClick={handleGoogleLogin}
        className="w-full border py-2 rounded hover:bg-gray-100"
      >
        Entrar com Google
      </button>
    </div>
  );
}