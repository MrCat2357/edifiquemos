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
    if (!user) { setNomeExibicao(""); return; }
    setCarregandoNome(true);
    const unsubscribe = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        const nome = d.nome || "";
        const titulo = d.titulo || "";
        setNomeExibicao(titulo && nome ? `${titulo} ${nome}` : nome || user.email || "Usuário");
      } else {
        setNomeExibicao(user.email || "Usuário");
      }
      setCarregandoNome(false);
    });
    return () => unsubscribe();
  }, [user]);

  async function handleLogout() {
    await signOut(auth);
    router.push("/login");
  }

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="header-logo">
          <span className="header-logo-dot" />
          Voz da Fé
        </Link>

        <nav>
          <ul className="header-nav">
            <li><Link href="/">Home</Link></li>
            <li><Link href="/posts">Posts</Link></li>
            {user && <li><Link href="/criar-post">Publicar</Link></li>}
          </ul>
        </nav>

        <div className="header-actions">
          {loading ? (
            <span style={{ color: "var(--text-3)", fontSize: "0.8rem" }}>...</span>
          ) : user ? (
            <>
              <button className="header-user-btn" onClick={() => router.push("/perfil")}>
                {carregandoNome ? "..." : nomeExibicao}
              </button>
              <button className="header-btn-logout" onClick={handleLogout}>Sair</button>
            </>
          ) : (
            <>
              <Link href="/login" className="header-user-btn" style={{ border: "none", background: "none" }}>
                Entrar
              </Link>
              <Link href="/cadastro" className="header-btn-primary">Cadastrar</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}