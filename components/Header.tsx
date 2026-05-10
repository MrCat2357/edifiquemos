"use client";

import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

function IconSearch({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 10L13.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function Header() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [nomeExibicao, setNomeExibicao] = useState("");
  const [carregandoNome, setCarregandoNome] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);

  const [busca, setBusca] = useState(() => searchParams.get("q") ?? "");
  const [buscaFocada, setBuscaFocada] = useState(false);
  const [mobileBuscaFocada, setMobileBuscaFocada] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  // Sincroniza campo com a URL ao navegar
  useEffect(() => {
    setBusca(searchParams.get("q") ?? "");
  }, [searchParams]);

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
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuAberto(false); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [menuAberto]);

  useEffect(() => {
    document.body.style.overflow = menuAberto ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuAberto]);

  // Fecha drawer ao mudar de rota
  useEffect(() => { setMenuAberto(false); }, [pathname]);

  async function handleLogout() {
    setMenuAberto(false);
    await signOut(auth);
    router.push("/login");
  }

  function fecharMenu() { setMenuAberto(false); }

  function submeterBusca(termo: string, fecharDrawer = false) {
    const t = termo.trim();
    if (fecharDrawer) setMenuAberto(false);
    router.push(t ? `/?q=${encodeURIComponent(t)}` : "/");
  }

  function limparBusca(focusRef?: React.RefObject<HTMLInputElement | null>) {
    setBusca("");
    router.push("/");
    setTimeout(() => focusRef?.current?.focus(), 50);
  }

  // ── Barra de busca — desktop ──────────────────────────────────
  const searchBarDesktop = (
    <form
      onSubmit={(e) => { e.preventDefault(); submeterBusca(busca); }}
      style={{ display: "flex", alignItems: "center" }}
    >
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "0.375rem",
        background: "var(--bg-elevated)",
        border: `1px solid ${buscaFocada ? "var(--emerald)" : "var(--border-light)"}`,
        borderRadius: "var(--radius-full)",
        padding: "5px 10px",
        transition: "border-color 0.2s, box-shadow 0.2s, width 0.25s ease",
        boxShadow: buscaFocada ? "0 0 0 3px var(--emerald-dim)" : "none",
        width: buscaFocada ? "220px" : "170px",
      }}>
        <span style={{ color: "var(--text-3)", flexShrink: 0, display: "flex" }}>
          <IconSearch size={14} />
        </span>
        <input
          ref={inputRef}
          type="text"
          placeholder="Buscar sermões..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onFocus={() => setBuscaFocada(true)}
          onBlur={() => setBuscaFocada(false)}
          style={{
            flex: 1, background: "none", border: "none", outline: "none",
            color: "var(--text-1)", fontSize: "0.82rem",
            fontFamily: "inherit", minWidth: 0,
          }}
        />
        {busca && (
          <button
            type="button"
            onClick={() => limparBusca(inputRef)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-3)", fontSize: "0.85rem", padding: "0 1px",
              display: "flex", alignItems: "center", flexShrink: 0, lineHeight: 1,
            }}
            aria-label="Limpar busca"
          >
            ✕
          </button>
        )}
      </div>
    </form>
  );

  // ── Barra de busca — drawer mobile ───────────────────────────
  const searchBarMobile = (
    <div style={{ padding: "0.875rem 1.25rem", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
      <form onSubmit={(e) => { e.preventDefault(); submeterBusca(busca, true); }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          background: "var(--bg)",
          border: `1px solid ${mobileBuscaFocada ? "var(--emerald)" : "var(--border-light)"}`,
          borderRadius: "var(--radius-full)",
          padding: "8px 12px",
          transition: "border-color 0.2s, box-shadow 0.2s",
          boxShadow: mobileBuscaFocada ? "0 0 0 3px var(--emerald-dim)" : "none",
        }}>
          <span style={{ color: "var(--text-3)", flexShrink: 0, display: "flex" }}>
            <IconSearch size={15} />
          </span>
          <input
            ref={mobileInputRef}
            type="text"
            placeholder="Buscar sermões e artigos..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onFocus={() => setMobileBuscaFocada(true)}
            onBlur={() => setMobileBuscaFocada(false)}
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              color: "var(--text-1)", fontSize: "0.9rem", fontFamily: "inherit",
            }}
          />
          {busca ? (
            <button
              type="button"
              onClick={() => limparBusca(mobileInputRef)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--text-3)", fontSize: "1rem", padding: "0 2px",
                display: "flex", alignItems: "center", flexShrink: 0, lineHeight: 1,
              }}
              aria-label="Limpar busca"
            >
              ✕
            </button>
          ) : (
            <button
              type="submit"
              style={{
                background: "var(--emerald)", border: "none", cursor: "pointer",
                color: "#fff", fontSize: "0.72rem", fontWeight: 700,
                padding: "4px 10px", borderRadius: "var(--radius-full)",
                flexShrink: 0, fontFamily: "inherit",
              }}
            >
              Ir
            </button>
          )}
        </div>

        {/* Indicador da busca ativa */}
        {searchParams.get("q") && (
          <p style={{ fontSize: "0.72rem", color: "var(--text-3)", marginTop: "0.5rem", paddingLeft: "0.25rem" }}>
            Buscando:{" "}
            <strong style={{ color: "var(--emerald)" }}>{searchParams.get("q")}</strong>
            {" · "}
            <span
              onClick={() => { setBusca(""); router.push("/"); setMenuAberto(false); }}
              style={{ color: "var(--emerald)", cursor: "pointer", fontWeight: 600 }}
            >
              Limpar
            </span>
          </p>
        )}
      </form>
    </div>
  );

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <Link href="/" className="header-logo" onClick={fecharMenu}>
            <span className="header-logo-dot" />
            Voz da Fé
          </Link>

          <nav className="header-nav-desktop">
            <ul className="header-nav">
              <li><Link href="/">Início</Link></li>
              <li><Link href="/perfis">Perfis</Link></li>
              {user && <li><Link href="/criar-post">Publicar</Link></li>}
              {user && <li><Link href="/criar-serie">Criar série</Link></li>}
            </ul>
          </nav>

          {/* ✅ Busca desktop */}
          <div className="header-search-desktop">
            {searchBarDesktop}
          </div>

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
                <Link href="/login" className="header-user-btn" style={{ border: "none", background: "none" }}>Entrar</Link>
                <Link href="/cadastro" className="header-btn-primary">Cadastrar</Link>
              </>
            )}
          </div>

          <button
            className={`header-hamburger${menuAberto ? " is-open" : ""}`}
            onClick={() => setMenuAberto((v) => !v)}
            aria-label={menuAberto ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menuAberto}
          >
            <div className="header-hamburger-lines">
              <span /><span /><span />
            </div>
            <span className="header-hamburger-label">
              {menuAberto ? "Fechar" : "Navegar"}
            </span>
          </button>
        </div>
      </header>

      <div className={`mobile-overlay${menuAberto ? " is-visible" : ""}`} onClick={fecharMenu} aria-hidden="true" />

      <nav className={`mobile-drawer${menuAberto ? " is-open" : ""}`} aria-hidden={!menuAberto}>
        <div className="mobile-drawer-header">
          <span className="header-logo"><span className="header-logo-dot" />Voz da Fé</span>
        </div>

        {/* ✅ Busca no topo do drawer */}
        {searchBarMobile}

        <ul className="mobile-nav-list">
          <li><Link href="/" className="mobile-nav-link" onClick={fecharMenu}>🏠 Início</Link></li>
          <li><Link href="/perfis" className="mobile-nav-link" onClick={fecharMenu}>👥 Perfis</Link></li>
          {user && <li><Link href="/criar-post" className="mobile-nav-link" onClick={fecharMenu}>✍️ Publicar</Link></li>}
          {user && <li><Link href="/criar-serie" className="mobile-nav-link" onClick={fecharMenu}>📚 Criar série</Link></li>}
          {user && (
            <li>
              <button
                className="mobile-nav-link"
                style={{ width: "100%", background: "none", border: "none", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}
                onClick={() => { fecharMenu(); router.push("/perfil"); }}
              >
                👤 Meu Perfil
              </button>
            </li>
          )}
        </ul>

        <div className="mobile-drawer-footer">
          {loading ? null : user ? (
            <>
              <button className="mobile-nav-user-btn" onClick={() => { fecharMenu(); router.push("/perfil"); }}>
                {carregandoNome ? "..." : nomeExibicao}
              </button>
              <button className="mobile-nav-logout-btn" onClick={handleLogout}>Sair</button>
            </>
          ) : (
            <>
              <Link href="/login" className="mobile-nav-link" onClick={fecharMenu}>Entrar</Link>
              <Link href="/cadastro" className="mobile-nav-cta" onClick={fecharMenu}>Cadastrar</Link>
            </>
          )}
        </div>
      </nav>
    </>
  );
}