"use client";

import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";

import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";

export default function Header() {
  const { user, loading } = useAuth();

  const [nomeExibicao, setNomeExibicao] = useState("...");
  const [carregandoNome, setCarregandoNome] = useState(false);

  useEffect(() => {
    async function fetchUser() {
      if (!user) return;

      setCarregandoNome(true);

      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();

          const nome = data.nome || "";
          const titulo = data.titulo || "";

          if (nome && titulo) {
            setNomeExibicao(`${titulo} ${nome}`);
          } else if (nome) {
            setNomeExibicao(nome);
          } else {
            setNomeExibicao(user.email || "Usuário");
          }
        } else {
          setNomeExibicao(user.email || "Usuário");
        }
      } catch (error) {
        console.error("Erro ao buscar usuário:", error);
        setNomeExibicao(user.email || "Usuário");
      }

      setCarregandoNome(false);
    }

    fetchUser();
  }, [user]);

  async function handleLogout() {
    await signOut(auth);
  }

  return (
    <header className="bg-gray-900 text-white">
      <nav className="max-w-2xl mx-auto flex justify-between items-center p-4">
        <span className="font-bold text-lg">Sermões</span>

        <div className="flex gap-4 items-center text-sm">
          <Link href="/">Home</Link>
          <Link href="/posts">Posts</Link>

          {loading ? (
            <span>...</span>
          ) : user ? (
            <>
              <span>
                {carregandoNome ? "..." : nomeExibicao}
              </span>

              <button
                onClick={handleLogout}
                className="bg-red-600 px-3 py-1 rounded"
              >
                Sair
              </button>
            </>
          ) : (
            <>
              <Link href="/login">Login</Link>
              <Link href="/cadastro">Cadastro</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}