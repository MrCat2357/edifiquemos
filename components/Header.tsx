"use client";

import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";

import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Header() {
  const { user, loading } = useAuth();

  const router = useRouter(); // ✅ AGORA ESTÁ NO LUGAR CERTO

  const [nomeExibicao, setNomeExibicao] = useState("");
  const [carregandoNome, setCarregandoNome] = useState(false);

  useEffect(() => {
    async function fetchUser() {
      if (!user) {
        setNomeExibicao("");
        return;
      }

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

        {/* 🔥 LOGO */}
        <span className="font-bold text-lg">
          Sermões e Artigos
        </span>

        {/* 🔗 LINKS */}
        <div className="flex gap-4 items-center text-sm">

          <Link href="/">Home</Link>
          <Link href="/posts">Posts</Link>

          {user && (
            <Link href="/criar-post">Criar Post</Link>
          )}

          {loading ? (
            <span>...</span>

          ) : user ? (
            <div className="flex items-center gap-3">

              {/* 👤 NOME (LINK PRO PERFIL) */}
              <button
                onClick={() => router.push("/perfil")}
                className="hover:underline cursor-pointer"
              >
                {carregandoNome ? "..." : nomeExibicao}
              </button>

              {/* 🔴 SAIR */}
              <button
                onClick={handleLogout}
                className="
                  bg-red-600
                  hover:bg-red-700
                  px-3 py-1 rounded
                  cursor-pointer
                  transition
                  active:scale-95
                "
              >
                Sair
              </button>

            </div>

          ) : (
            <div className="flex gap-3">
              <Link href="/login">Login</Link>
              <Link href="/cadastro">Cadastro</Link>
            </div>
          )}

        </div>
      </nav>
    </header>
  );
}