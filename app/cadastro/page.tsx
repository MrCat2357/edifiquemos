"use client";

import { Suspense, useState } from "react";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  doc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { slugify } from "@/lib/slugify";

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

// ✅ Componente interno que usa useSearchParams
function CadastroForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [nome, setNome] = useState("");
  const [titulo, setTitulo] = useState("");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [error, setError] = useState("");
  const [linkParaLogin, setLinkParaLogin] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLinkParaLogin(false);

    if (!nome.trim()) { setError("O nome é obrigatório."); return; }
    if (senha.length < 6) { setError("A senha deve ter pelo menos 6 caracteres."); return; }
    if (!aceitouTermos) { setError("Você precisa aceitar os termos de uso."); return; }

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
      const user = userCredential.user;

      const nomeCompleto = titulo.trim()
        ? `${titulo.trim()} ${nome.trim()}`
        : nome.trim();

      const slug = await gerarSlugUnico(nomeCompleto, user.uid);

      await updateProfile(user, { displayName: nomeCompleto });

      await setDoc(doc(db, "users", user.uid), {
        nome: nome.trim(),
        titulo: titulo.trim(),
        email,
        fotoUrl: null,
        slug,
        criadoEm: new Date(),
        aceitouTermos: true,
      });

      const redirect = sessionStorage.getItem("redirect-after-auth");
      if (redirect) {
        sessionStorage.removeItem("redirect-after-auth");
        router.push(redirect);
      } else {
        router.push("/criar-post");
      }

    } catch (err: any) {
      if (err.code === "auth/email-already-in-use") {
        try {
          await signInWithEmailAndPassword(auth, email, senha);
          await auth.signOut();
          setError("Este email já tem uma conta. Use o login para entrar.");
          setLinkParaLogin(true);
        } catch (innerErr: any) {
          if (
            innerErr.code === "auth/wrong-password" ||
            innerErr.code === "auth/invalid-credential"
          ) {
            const qEmail = query(
              collection(db, "users"),
              where("email", "==", email)
            );
            const snapEmail = await getDocs(qEmail);

            if (snapEmail.empty) {
              setError(
                "Este email foi usado anteriormente com o Google. " +
                "Faça login com o Google — o cadastro por lá não foi concluído, " +
                "mas você poderá completar seu perfil após entrar."
              );
            } else {
              setError("Email já cadastrado. Tente outra senha ou use 'Esqueci a senha'.");
              setLinkParaLogin(true);
            }
          } else {
            setError("Esse email já está em uso. Tente fazer login.");
            setLinkParaLogin(true);
          }
        }
      } else if (err.code === "auth/invalid-email") {
        setError("Email inválido.");
      } else {
        setError("Erro ao criar conta.");
      }
    }

    setLoading(false);
  }

  return (
    <div className="auth-page">
      <div className="auth-card">

        <div className="auth-logo">
          <span className="auth-logo-dot" />
          Voz da Fé
        </div>

        <h1 className="auth-title">Criar sua conta</h1>
        <p className="auth-subtitle">Junte-se à comunidade e compartilhe sua fé</p>

        <form onSubmit={handleCadastro} className="auth-form">

          <div className="auth-field">
            <label className="auth-label">
              Título <span className="auth-label-opt">(opcional)</span>
            </label>
            <input
              list="titulos"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="auth-input"
              placeholder="Ex: Pr., Pastor, Rev...."
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

          <div className="auth-field">
            <label className="auth-label">Nome</label>
            <input
              type="text"
              placeholder="Seu nome completo"
              className="auth-input"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>

          <div className="auth-field">
            <label className="auth-label">Email</label>
            <input
              type="email"
              placeholder="seu@email.com"
              className="auth-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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

          {error && (
            <div className="auth-error">
              <p>{error}</p>
              {linkParaLogin && (
                <Link href={`/login?email=${email}`} className="auth-error-link">
                  Ir para o login →
                </Link>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="auth-btn-primary"
          >
            {loading ? "Criando conta..." : "Criar conta"}
          </button>
        </form>

        <div className="auth-links">
          <span style={{ color: "var(--text-3)", fontSize: "0.85rem" }}>
            Já tem uma conta?
          </span>
          <span className="auth-link-sep">·</span>
          <Link href="/login" className="auth-link">
            Entrar
          </Link>
        </div>
      </div>
    </div>
  );
}

// ✅ Page exporta com Suspense envolvendo o componente
export default function Cadastro() {
  return (
    <Suspense fallback={<div className="auth-page"><div className="auth-card">Carregando...</div></div>}>
      <CadastroForm />
    </Suspense>
  );
}