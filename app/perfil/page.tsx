"use client";

import { useEffect, useRef, useState } from "react";
import { auth, db, storage } from "@/lib/firebase";
import { updateProfile } from "firebase/auth";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  writeBatch,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useRouter } from "next/navigation";
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

function getInitials(name: string) {
  if (!name) return "?";
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function Avatar({
  src,
  name,
  size = 64,
}: {
  src?: string | null;
  name: string;
  size?: number;
}) {
  const base: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  };

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{
          ...base,
          objectFit: "cover",
          boxShadow: "0 0 0 3px var(--emerald-dim)",
        }}
      />
    );
  }

  return (
    <div
      style={{
        ...base,
        background: "linear-gradient(135deg, var(--emerald-dark), var(--emerald))",
        color: "#fff",
        fontSize: Math.round(size * 0.36) + "px",
        fontWeight: 700,
        letterSpacing: "-0.01em",
        boxShadow: size >= 56 ? "0 0 0 3px var(--emerald-dim)" : "none",
        userSelect: "none",
      }}
    >
      {getInitials(name)}
    </div>
  );
}

export default function Perfil() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [nome, setNome] = useState("");
  const [titulo, setTitulo] = useState("");
  const [bio, setBio] = useState("");
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);

  const [editando, setEditando] = useState(false);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [uploadandoFoto, setUploadandoFoto] = useState(false);

  const [rascNome, setRascNome] = useState("");
  const [rascTitulo, setRascTitulo] = useState("");
  const [rascBio, setRascBio] = useState("");
  const [rascFotoPreview, setRascFotoPreview] = useState<string | null>(null);
  const [rascFotoFile, setRascFotoFile] = useState<File | null>(null);

  const [posts, setPosts] = useState<any[]>([]);

  async function carregar() {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const d = snap.data();
        setNome(d.nome || "");
        setTitulo(d.titulo || "");
        setBio(d.bio || "");
        setFotoUrl(d.fotoUrl || null);
      } else {
        setNome(user.displayName || "");
        setFotoUrl(user.photoURL || null);
      }
      const q = query(
        collection(db, "posts"),
        where("autorId", "==", user.uid),
        orderBy("data", "desc")
      );
      const snapshot = await getDocs(q);
      const lista: any[] = [];
      snapshot.forEach((d) => lista.push({ id: d.id, ...d.data() }));
      setPosts(lista);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  function abrirEdicao() {
    setRascNome(nome);
    setRascTitulo(titulo);
    setRascBio(bio);
    setRascFotoPreview(fotoUrl);
    setRascFotoFile(null);
    setEditando(true);
  }

  function onEscolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRascFotoFile(file);
    setRascFotoPreview(URL.createObjectURL(file));
  }

  async function salvar() {
    const user = auth.currentUser;
    if (!user) return;
    if (!rascNome.trim()) {
      alert("O nome é obrigatório.");
      return;
    }
    setSalvando(true);
    try {
      let novaFotoUrl = fotoUrl;
      if (rascFotoFile) {
        setUploadandoFoto(true);
        const storageRef = ref(storage, `avatars/${user.uid}`);
        await uploadBytes(storageRef, rascFotoFile);
        novaFotoUrl = await getDownloadURL(storageRef);
        setUploadandoFoto(false);
      }
      const nomeCompleto = rascTitulo.trim()
        ? `${rascTitulo.trim()} ${rascNome.trim()}`
        : rascNome.trim();
      const slug = await gerarSlugUnico(nomeCompleto, user.uid);
      await updateDoc(doc(db, "users", user.uid), {
        nome: rascNome,
        titulo: rascTitulo,
        bio: rascBio,
        fotoUrl: novaFotoUrl,
        slug,
      });
      await updateProfile(user, {
        displayName: rascNome,
        photoURL: novaFotoUrl ?? undefined,
      });
      const q = query(
        collection(db, "posts"),
        where("autorId", "==", user.uid)
      );
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.forEach((postDoc) => {
        batch.update(postDoc.ref, {
          autorNome: nomeCompleto,
          autorFoto: novaFotoUrl,
        });
      });
      await batch.commit();
      await carregar();
      setEditando(false);
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar perfil.");
    }
    setSalvando(false);
  }

  if (loading)
    return (
      <div className="post-detail-loading">
        <div className="spinner" />
        Carregando perfil...
      </div>
    );

  const nomeExibicao = titulo.trim()
    ? `${titulo.trim()} ${nome.trim()}`
    : nome.trim() || "Usuário";

  const rascNomeExibicao = rascTitulo.trim()
    ? `${rascTitulo.trim()} ${rascNome.trim()}`
    : rascNome.trim() || "Seu nome";

  return (
    <div className="perfil-wrapper">

      {/* ══════════════════════════════════════════
          MODO VISUALIZAÇÃO
      ══════════════════════════════════════════ */}
      {!editando && (
        <div className="perfil-card">
          <Avatar src={fotoUrl} name={nomeExibicao} size={64} />
          <div className="perfil-info" style={{ flex: 1 }}>
            <h1 className="perfil-nome">{nomeExibicao}</h1>
            {bio ? (
              <p className="perfil-bio">{bio}</p>
            ) : (
              <p className="perfil-bio-vazia">Sem descrição.</p>
            )}
            <div className="perfil-stat">
              <span className="perfil-stat-num">{posts.length}</span>
              <span className="perfil-stat-label">publicações</span>
            </div>
          </div>
          <div style={{ alignSelf: "flex-start" }}>
            <button className="post-btn-edit" onClick={abrirEdicao}>
              ✏ Editar perfil
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          MODO EDIÇÃO
      ══════════════════════════════════════════ */}
      {editando && (
        <div
          className="perfil-card"
          style={{ flexDirection: "column", gap: "1.75rem", alignItems: "stretch" }}
        >
          {/* Foto + preview */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.875rem",
            }}
          >
            <div
              onClick={() => fileInputRef.current?.click()}
              title="Clique para trocar a foto"
              style={{ position: "relative", cursor: "pointer" }}
            >
              <Avatar src={rascFotoPreview} name={rascNomeExibicao} size={96} />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: 0,
                  transition: "opacity 0.18s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}
              >
                <span style={{ fontSize: "1.5rem" }}>📷</span>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={onEscolherFoto}
            />

            <div style={{ textAlign: "center" }}>
              <p
                className="perfil-nome"
                style={{ fontSize: "1.1rem", marginBottom: "0.2rem" }}
              >
                {rascNomeExibicao}
              </p>
              <p style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>
                Clique na foto para trocar · JPG, PNG ou WebP · máx. 2 MB
              </p>
            </div>
          </div>

          {/* Divisor */}
          <div
            style={{
              height: "1px",
              background: "var(--border)",
              margin: "0 -2rem",
            }}
          />

          {/* Campos */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 2fr",
                gap: "0.75rem",
              }}
            >
              <div className="auth-field">
                <label className="auth-label">
                  Título{" "}
                  <span className="auth-label-opt">(opcional)</span>
                </label>
                <input
                  className="auth-input"
                  placeholder="Pastor, Pr., Rev..."
                  value={rascTitulo}
                  onChange={(e) => setRascTitulo(e.target.value)}
                />
              </div>
              <div className="auth-field">
                <label className="auth-label">Nome</label>
                <input
                  className="auth-input"
                  placeholder="Seu nome completo"
                  value={rascNome}
                  onChange={(e) => setRascNome(e.target.value)}
                />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label">
                Sobre você{" "}
                <span className="auth-label-opt">(opcional)</span>
              </label>
              <textarea
                className="auth-input"
                style={{ minHeight: "6rem", resize: "vertical", lineHeight: 1.65 }}
                placeholder="Conte sobre sua história, ministério ou motivação..."
                value={rascBio}
                onChange={(e) => setRascBio(e.target.value)}
              />
            </div>
          </div>

          {/* Botões */}
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              onClick={salvar}
              disabled={salvando}
              className="auth-btn-primary"
              style={{ flex: 1 }}
            >
              {uploadandoFoto
                ? "Enviando foto..."
                : salvando
                ? "Salvando..."
                : "Salvar alterações"}
            </button>
            <button
              onClick={() => setEditando(false)}
              disabled={salvando}
              className="post-btn-delete"
              style={{
                padding: "11px 20px",
                borderRadius: "var(--radius-full)",
                fontSize: "0.85rem",
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          PUBLICAÇÕES
      ══════════════════════════════════════════ */}
      <div className="perfil-posts-section">
        <h2 className="perfil-posts-title">Meus conteúdos</h2>

        {posts.length === 0 && (
          <div className="empty-state">Você ainda não publicou nada.</div>
        )}

        <div className="posts-list">
          {posts.map((post) => {
            return (
              <div key={post.id} className="post-card">
                <div className="card-header-row">
                  <Avatar src={fotoUrl} name={nomeExibicao} size={36} />
                  <div className="author-col">
                    <span className="author-name-link">{nomeExibicao}</span>
                    <span className="card-meta">
                      {post.data?.toDate
                        ? post.data.toDate().toLocaleDateString("pt-BR")
                        : ""}
                      {post.igreja ? ` · ${post.igreja}` : ""}
                    </span>
                  </div>
                  <span
                    className={`cat-badge ${
                      post.tipo === "sermao" ? "cat-sermao" : "cat-artigo"
                    }`}
                  >
                    {post.tipo === "sermao" ? "Sermão" : "Artigo"}
                  </span>
                </div>

                <div
                  className="card-body-area"
                  onClick={() =>
                    router.push(
                      `/posts/${
                        post.tipo === "sermao" ? "sermoes" : "artigos"
                      }/${post.slug}`
                    )
                  }
                  style={{ cursor: "pointer" }}
                >
                  <h3 className="card-title">{post.titulo}</h3>
                  {post.resumo && (
                    <p className="card-frase">{post.resumo}</p>
                  )}
                </div>

                <div className="card-footer-row">
                  <span
                    className="read-link"
                    onClick={() =>
                      router.push(
                        `/posts/${
                          post.tipo === "sermao" ? "sermoes" : "artigos"
                        }/${post.slug}`
                      )
                    }
                  >
                    Ler completo →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
