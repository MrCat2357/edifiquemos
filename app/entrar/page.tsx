"use client";

import { Suspense, useState, useEffect } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  fetchSignInMethodsForEmail,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { slugify } from "@/lib/slugify";

// ─── helpers ────────────────────────────────────────────────────────────────

async function gerarSlugUnico(base: string, uidAtual: string): Promise<string> {
  const baseSlug = slugify(base);
  let candidato = baseSlug;
  let contador = 1;
  while (true) {
    const q = query(collection(db, "users"), where("slug", "==", candidato));
    const snap = await getDocs(q);
    if (snap.empty || (snap.size === 1 && snap.docs[0].id === uidAtual))
      return candidato;
    contador += 1;
    candidato = `${baseSlug}-${contador}`;
  }
}

async function emailExisteNoFirestore(email: string): Promise<boolean> {
  const q = query(collection(db, "users"), where("email", "==", email));
  const snap = await getDocs(q);
  return !snap.empty;
}


// ─── tipos ──────────────────────────────────────────────────────────────────

type Etapa = "email" | "senha" | "cadastro" | "termos-google";

type DadosGoogle = {
  uid: string;
  nome: string;
  email: string;
  fotoUrl: string | null;
};

// ─── componente interno (usa useSearchParams) ────────────────────────────────

function EntrarForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [etapa, setEtapa] = useState<Etapa>("email");

  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [showSenha, setShowSenha] = useState(false);

  const [dadosGoogle, setDadosGoogle] = useState<DadosGoogle | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Captura o resultado do redirect (mobile) ao montar ──────────────────
  useEffect(() => {
    // Mostra config na tela temporariamente
    setError(`Auth: ${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN} | Project: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}`);
    
    async function verificarRedirectResult() {
      try {
        console.log("🔍 Verificando redirect result...");
        const result = await getRedirectResult(auth);
        console.log("✅ Result:", JSON.stringify(result));
        if (!result) {
          console.log("❌ Result nulo");
          return;
        }

        const user = result.user;
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          redirecionarAposAuth();
          return;
        }

        setDadosGoogle({
          uid: user.uid,
          nome: user.displayName ?? user.email?.split("@")[0] ?? "Usuário",
          email: user.email ?? "",
          fotoUrl: user.photoURL ?? null,
        });
        setAceitouTermos(false);
        setEtapa("termos-google");
      } catch (err: any) {
        if (err.code === "auth/account-exists-with-different-credential") {
          const methods = await fetchSignInMethodsForEmail(
            auth,
            err.customData?.email ?? ""
          );
          if (methods.includes("password")) {
            setEtapa("senha");
            setError(
              "Sua conta usa senha. Entre com sua senha e depois poderá " +
              "vincular o Google nas configurações."
            );
            return;
          }
        }
        console.error(err);
        setError("Erro ao entrar com Google. Tente novamente.");
      }
    }

    verificarRedirectResult();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── utilitário de redirecionamento pós-auth ──────────────────────────────
  function redirecionarAposAuth() {
    const raw = sessionStorage.getItem("redirect-after-auth");
    sessionStorage.removeItem("redirect-after-auth");

    if (raw) {
      try {
        const url = new URL(raw);
        router.push(url.pathname + url.search + url.hash);
      } catch {
        router.push(raw);
      }
    } else {
      router.push("/");
    }
  }

  // ── passo 1: verificar email ─────────────────────────────────────────────

  async function handleVerificarEmail(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const existe = await emailExisteNoFirestore(email);
      setEtapa(existe ? "senha" : "cadastro");
    } catch {
      setError("Erro ao verificar o email. Tente novamente.");
    }

    setLoading(false);
  }

  // ── passo 2a: login com senha ────────────────────────────────────────────

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, senha);
      redirecionarAposAuth();
    } catch (err: any) {
      if (
        err.code === "auth/wrong-password" ||
        err.code === "auth/invalid-credential"
      ) {
        setError("Senha incorreta. Tente novamente.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Muitas tentativas. Aguarde alguns minutos e tente de novo.");
      } else {
        setError("Erro ao entrar. Tente novamente.");
      }
    }

    setLoading(false);
  }

  // ── passo 2b: cadastro por email ─────────────────────────────────────────

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!nome.trim()) { setError("O nome é obrigatório."); return; }
    if (senha.length < 6) { setError("A senha deve ter pelo menos 6 caracteres."); return; }
    if (!aceitouTermos) { setError("Você precisa aceitar os termos de uso."); return; }

    setLoading(true);

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, senha);
      const user = cred.user;

      const slug = await gerarSlugUnico(nome.trim(), user.uid);
      await updateProfile(user, { displayName: nome.trim() });
      await setDoc(doc(db, "users", user.uid), {
        nome: nome.trim(),
        titulo: "",
        email,
        fotoUrl: null,
        slug,
        criadoEm: new Date(),
        aceitouTermos: true,
      });

      redirecionarAposAuth();
    } catch (err: any) {
      if (err.code === "auth/email-already-in-use") {
        setEtapa("senha");
        setError("Este email já tem uma senha cadastrada. Entre com ela abaixo.");
      } else {
        setError("Erro ao criar conta. Tente novamente.");
      }
    }

    setLoading(false);
  }

  // ── Google ───────────────────────────────────────────────────────────────

  async function handleGoogle() {
  setError("");
  setLoading(true);

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    let result;
    try {
      result = await signInWithPopup(auth, provider);
    } catch (popupErr: any) {
      if (
        popupErr.code === "auth/popup-blocked" ||
        popupErr.code === "auth/cancelled-popup-request" ||
        popupErr.code === "auth/popup-closed-by-user"
      ) {
        // Popup bloqueado → tenta redirect como fallback
        await signInWithRedirect(auth, provider);
        return;
      }
      if (popupErr.code === "auth/account-exists-with-different-credential") {
        const methods = await fetchSignInMethodsForEmail(
          auth,
          popupErr.customData?.email ?? email
        );
        if (methods.includes("password")) {
          setEtapa("senha");
          setError(
            "Sua conta usa senha. Entre com sua senha e depois poderá " +
            "vincular o Google nas configurações."
          );
          setLoading(false);
          return;
        }
      }
      throw popupErr;
    }

    const user = result.user;
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      redirecionarAposAuth();
      return;
    }

    setDadosGoogle({
      uid: user.uid,
      nome: user.displayName ?? user.email?.split("@")[0] ?? "Usuário",
      email: user.email ?? "",
      fotoUrl: user.photoURL ?? null,
    });
    setAceitouTermos(false);
    setEtapa("termos-google");
  } catch (err: any) {
    console.error(err);
    setError("Erro ao entrar com Google. Tente novamente.");
  }

  setLoading(false);
}

  // ── passo final: confirmar termos e criar doc (Google) ───────────────────

  async function handleConfirmarTermosGoogle(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!aceitouTermos) {
      setError("Você precisa aceitar os termos de uso para continuar.");
      return;
    }

    if (!dadosGoogle) return;
    setLoading(true);

    try {
      const slug = await gerarSlugUnico(dadosGoogle.nome, dadosGoogle.uid);
      await setDoc(doc(db, "users", dadosGoogle.uid), {
        nome: dadosGoogle.nome,
        titulo: "",
        email: dadosGoogle.email,
        fotoUrl: dadosGoogle.fotoUrl,
        slug,
        criadoEm: new Date(),
        aceitouTermos: true,
      });

      redirecionarAposAuth();
    } catch (err) {
      console.error(err);
      setError("Erro ao finalizar o cadastro. Tente novamente.");
    }

    setLoading(false);
  }

  // ── render ────────────────────────────────────────────────────────────────

  const subtitulos: Record<Etapa, string> = {
    email: "Bem-vindo! Digite seu email para começar.",
    senha: "Encontramos sua conta. Digite sua senha.",
    cadastro: "Email novo por aqui! Vamos criar sua conta.",
    "termos-google": `Olá, ${dadosGoogle?.nome ?? ""}! Só falta aceitar os termos.`,
  };

  return (
    <div className="auth-page">
      <div className="auth-card">

        {/* LOGO */}
        <div className="auth-logo">
          <span className="auth-logo-dot" />
          Edifiquemos
        </div>

        <h1 className="auth-title">
          {etapa === "cadastro" || etapa === "termos-google"
            ? "Criar sua conta"
            : "Entrar na sua conta"}
        </h1>
        <p className="auth-subtitle">{subtitulos[etapa]}</p>

        {/* ── ETAPA: EMAIL ── */}
        {etapa === "email" && (
          <form onSubmit={handleVerificarEmail} className="auth-form">
            <div className="auth-field">
              <label className="auth-label">Email</label>
              <input
                type="email"
                placeholder="seu@email.com"
                className="auth-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
              />
            </div>

            {error && <div className="auth-error"><p>{error}</p></div>}

            <button type="submit" disabled={loading} className="auth-btn-primary">
              {loading ? "Verificando..." : "Continuar"}
            </button>

            <div className="auth-divider">
              <span /><p>ou continue com</p><span />
            </div>

            <GoogleBtn onClick={handleGoogle} loading={loading} />
          </form>
        )}

        {/* ── ETAPA: SENHA (login) ── */}
        {etapa === "senha" && (
          <form onSubmit={handleLogin} className="auth-form">
            <div className="auth-field">
              <label className="auth-label">Email</label>
              <div className="auth-email-readonly">
                <span>{email}</span>
                <button
                  type="button"
                  className="auth-link"
                  onClick={() => { setEtapa("email"); setError(""); setSenha(""); }}
                >
                  Trocar
                </button>
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label">Senha</label>
              <div className="auth-input-wrapper">
                <input
                  type={showSenha ? "text" : "password"}
                  placeholder="Sua senha"
                  className="auth-input"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  autoFocus
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowSenha(!showSenha)}
                  className="auth-eye-btn"
                >
                  {showSenha ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            {error && <div className="auth-error"><p>{error}</p></div>}

            <button type="submit" disabled={loading} className="auth-btn-primary">
              {loading ? "Entrando..." : "Entrar"}
            </button>

            <div className="auth-links" style={{ marginTop: "0.5rem" }}>
              <Link href={`/esqueci-senha?email=${encodeURIComponent(email)}`} className="auth-link">
                Esqueci a senha
              </Link>
            </div>
          </form>
        )}

        {/* ── ETAPA: CADASTRO (email) ── */}
        {etapa === "cadastro" && (
          <form onSubmit={handleCadastro} className="auth-form">
            <div className="auth-field">
              <label className="auth-label">Email</label>
              <div className="auth-email-readonly">
                <span>{email}</span>
                <button
                  type="button"
                  className="auth-link"
                  onClick={() => { setEtapa("email"); setError(""); setSenha(""); setNome(""); }}
                >
                  Trocar
                </button>
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label">Nome completo</label>
              <input
                type="text"
                placeholder="Seu nome completo"
                className="auth-input"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className="auth-field">
              <label className="auth-label">Senha</label>
              <div className="auth-input-wrapper">
                <input
                  type={showSenha ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  className="auth-input"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowSenha(!showSenha)}
                  className="auth-eye-btn"
                >
                  {showSenha ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            <label className="auth-terms">
              <input
                type="checkbox"
                checked={aceitouTermos}
                onChange={(e) => setAceitouTermos(e.target.checked)}
                className="auth-checkbox"
              />
              <span>
                Li e aceito os{" "}
                <Link href="/termos" className="auth-link">
                  Termos de Uso
                </Link>
              </span>
            </label>

            {error && <div className="auth-error"><p>{error}</p></div>}

            <button type="submit" disabled={loading} className="auth-btn-primary">
              {loading ? "Criando conta..." : "Criar conta"}
            </button>

            <div className="auth-divider">
              <span /><p>ou cadastre-se com</p><span />
            </div>
            <GoogleBtn onClick={handleGoogle} loading={loading} />
          </form>
        )}

        {/* ── ETAPA: TERMOS (Google — primeiro acesso) ── */}
        {etapa === "termos-google" && dadosGoogle && (
          <form onSubmit={handleConfirmarTermosGoogle} className="auth-form">

            <div style={{
              display: "flex", alignItems: "center", gap: "0.75rem",
              padding: "0.75rem 1rem",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-light)",
              borderRadius: "var(--radius-lg)",
              marginBottom: "0.25rem",
            }}>
              {dadosGoogle.fotoUrl && (
                <img
                  src={dadosGoogle.fotoUrl}
                  alt={dadosGoogle.nome}
                  style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                />
              )}
              <div>
                <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-1)", margin: 0 }}>
                  {dadosGoogle.nome}
                </p>
                <p style={{ fontSize: "0.78rem", color: "var(--text-3)", margin: 0 }}>
                  {dadosGoogle.email}
                </p>
              </div>
            </div>

            <label className="auth-terms">
              <input
                type="checkbox"
                checked={aceitouTermos}
                onChange={(e) => setAceitouTermos(e.target.checked)}
                className="auth-checkbox"
              />
              <span>
                Li e aceito os{" "}
                <Link href="/termos" className="auth-link" target="_blank">
                  Termos de Uso
                </Link>
              </span>
            </label>

            {error && <div className="auth-error"><p>{error}</p></div>}

            <button type="submit" disabled={loading} className="auth-btn-primary">
              {loading ? "Finalizando..." : "Concluir cadastro"}
            </button>

            <button
              type="button"
              className="auth-link"
              style={{ marginTop: "0.5rem", fontSize: "0.8rem", textAlign: "center" }}
              onClick={() => { setEtapa("email"); setDadosGoogle(null); setAceitouTermos(false); setError(""); }}
            >
              Cancelar e voltar
            </button>
          </form>
        )}

      </div>
    </div>
  );
}

// ─── botão Google reutilizável ────────────────────────────────────────────────

function GoogleBtn({
  onClick,
  loading,
}: {
  onClick: () => void;
  loading: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="auth-btn-google"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          fill="#EA4335"
        />
      </svg>
      Continuar com Google
    </button>
  );
}

// ─── export com Suspense ──────────────────────────────────────────────────────

export default function EntrarPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-page">
          <div className="auth-card">Carregando...</div>
        </div>
      }
    >
      <EntrarForm />
    </Suspense>
  );
}