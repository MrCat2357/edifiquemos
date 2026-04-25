"use client";

import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";

import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Header() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [nomeExibicao, setNomeExibicao] = useState("");
  const [carregandoNome, setCarregandoNome] = useState(false);

  useEffect(() => {
    if (!user) {
      setNomeExibicao("");
      return;
    }

    setCarregandoNome(true);

    const docRef = doc(db, "users", user.uid);

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
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

      setCarregandoNome(false);
    });

    return () => unsubscribe();
  }, [user]);

  async function handleLogout() {
    await signOut(auth);
    router.push("/login"); // ✅
  }

  return (
    <header className="bg-gray-900 text-white">
      <nav className="max-w-2xl mx-auto flex justify-between items-center p-4">

        <span className="font-bold text-lg">
          Sermões e Artigos
        </span>

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

              <button
                onClick={() => router.push("/perfil")}
                className="hover:underline cursor-pointer"
              >
                {carregandoNome ? "..." : nomeExibicao}
              </button>

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