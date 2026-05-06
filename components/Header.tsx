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
  const [menuAberto, setMenuAberto] = useState(false);

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

  useEffect(() => {
    if (!menuAberto) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuAberto(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [menuAberto]);

  useEffect(() => {
    document.body.style.overflow = menuAberto ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuAberto]);

  async function handleLogout() {
    setMenuAberto(false);
    await signOut(auth);
    router.push("/login");
  }

  function fecharMenu() {
    setMenuAberto(false);
  }

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <Link href="/" className="header-logo" onClick={fecharMenu}>
            <span className="header-logo-dot" />
            Voz da Fé
          </Link>

          {/* Nav desktop — apenas Publicar quando logado */}
          <nav className="header-nav-desktop">
            <ul className="header-nav">
              {user && <li><Link href="/criar-post">Publicar</Link></li>}
            </ul>
          </nav>

          {/* Ações desktop */}
          <div className="header-actions header-actions-desktop">
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

          {/* Botão hamburguer — só aparece no mobile */}
          <button
            className={`header-hamburger${menuAberto ? " is-open" : ""}`}
            onClick={() => setMenuAberto((v) => !v)}
            aria-label={menuAberto ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menuAberto}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>

      {/* Overlay do menu mobile */}
      <div
        className={`mobile-overlay${menuAberto ? " is-visible" : ""}`}
        onClick={fecharMenu}
        aria-hidden="true"
      />

      {/* Drawer mobile */}
      <nav className={`mobile-drawer${menuAberto ? " is-open" : ""}`} aria-hidden={!menuAberto}>
        <div className="mobile-drawer-header">
          <span className="header-logo">
            <span className="header-logo-dot" />
            Voz da Fé
          </span>
        </div>

        <ul className="mobile-nav-list">
          {user && (
            <li>
              <Link href="/criar-post" className="mobile-nav-link" onClick={fecharMenu}>
                Publicar
              </Link>
            </li>
          )}
          {user && (
            <li>
              <button
                className="mobile-nav-link"
                style={{
                  width: "100%",
                  background: "none",
                  border: "none",
                  textAlign: "left",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
                onClick={() => { fecharMenu(); router.push("/perfil"); }}
              >
                Meu Perfil
              </button>
            </li>
          )}
        </ul>

        <div className="mobile-drawer-footer">
          {loading ? null : user ? (
            <>
              <button
                className="mobile-nav-user-btn"
                onClick={() => { fecharMenu(); router.push("/perfil"); }}
              >
                {carregandoNome ? "..." : nomeExibicao}
              </button>
              <button className="mobile-nav-logout-btn" onClick={handleLogout}>
                Sair
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="mobile-nav-link" onClick={fecharMenu}>
                Entrar
              </Link>
              <Link href="/cadastro" className="mobile-nav-cta" onClick={fecharMenu}>
                Cadastrar
              </Link>
            </>
          )}
        </div>
      </nav>
    </>
  );
}