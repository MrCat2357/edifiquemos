"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
} from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";

type User = {
  nome?: string;
  titulo?: string;
  bio?: string;
  slug?: string;
  fotoUrl?: string | null;
};

function getInitials(name: string) {
  if (!name) return "?";
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function Avatar({ src, name, size = 64 }: { src?: string | null; name: string; size?: number }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
          boxShadow: "0 0 0 3px var(--emerald-dim)",
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "linear-gradient(135deg, var(--emerald-dark), var(--emerald))",
        color: "#fff",
        fontSize: Math.round(size * 0.36) + "px",
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        userSelect: "none",
        boxShadow: "0 0 0 3px var(--emerald-dim)",
      }}
    >
      {getInitials(name)}
    </div>
  );
}

async function resolverUid(idOuSlug: string): Promise<{ uid: string; userData: User } | null> {
  const qSlug = query(collection(db, "users"), where("slug", "==", idOuSlug));
  const snapSlug = await getDocs(qSlug);
  if (!snapSlug.empty) {
    const docSnap = snapSlug.docs[0];
    return { uid: docSnap.id, userData: docSnap.data() as User };
  }
  const docRef = doc(db, "users", idOuSlug);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { uid: docSnap.id, userData: docSnap.data() as User };
  }
  return null;
}

/* ── Navegação entre posts do mesmo autor ── */

function PostNavigation({
  posts,
  postAtualId,
}: {
  posts: any[];
  postAtualId: string;
}) {
  const router = useRouter();
  const idx = posts.findIndex((p) => p.id === postAtualId);
  if (idx === -1 || posts.length < 2) return null;

  // lista está em desc (mais recente primeiro)
  // idx+1 = mais antigo (publicado antes), idx-1 = mais recente (publicado depois)
  const anterior = idx + 1 < posts.length ? posts[idx + 1] : null;
  const proximo  = idx - 1 >= 0           ? posts[idx - 1] : null;

  function navUrl(p: any) {
    return `/posts/${p.tipo === "sermao" ? "sermoes" : "artigos"}/${p.slug}`;
  }

  return (
    <nav
      style={{
        display: "grid",
        gridTemplateColumns: anterior && proximo ? "1fr 1fr" : anterior ? "1fr auto" : "auto 1fr",
        gap: "0.75rem",
        marginTop: "1rem",
      }}
    >
      {anterior ? (
        <button
          onClick={() => router.push(navUrl(anterior))}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: "0.2rem",
            padding: "0.75rem 1rem",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-light)",
            borderRadius: "var(--radius-lg)",
            cursor: "pointer",
            textAlign: "left",
            transition: "border-color 0.15s",
            minWidth: 0,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--emerald-dim)")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-light)")}
        >
          <span style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--emerald)", opacity: 0.8 }}>
            {anterior.tipo === "sermao" ? "Sermão" : "Artigo"}
          </span>
          <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-1)", lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", wordBreak: "break-word" }}>
            {anterior.titulo}
          </span>
        </button>
      ) : <span />}

      {proximo ? (
        <button
          onClick={() => router.push(navUrl(proximo))}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: "0.2rem",
            padding: "0.75rem 1rem",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-light)",
            borderRadius: "var(--radius-lg)",
            cursor: "pointer",
            textAlign: "right",
            transition: "border-color 0.15s",
            minWidth: 0,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--emerald-dim)")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-light)")}
        >
          <span style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--emerald)", opacity: 0.8 }}>
            {proximo.tipo === "sermao" ? "Sermão" : "Artigo"}
          </span>
          <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-1)", lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", wordBreak: "break-word" }}>
            {proximo.titulo}
          </span>
        </button>
      ) : <span />}
    </nav>
  );
}

export default function PerfilPublico() {
  const { id } = useParams();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [compartilharAberto, setCompartilharAberto] = useState<string | null>(null);
  // ID do post cujos cards de nav estão expandidos
  const [navAberta, setNavAberta] = useState<string | null>(null);

  useEffect(() => {
    async function carregar() {
      if (!id) return;
      try {
        const resultado = await resolverUid(id as string);
        if (!resultado) { setLoading(false); return; }

        setUser(resultado.userData);
        setUid(resultado.uid);

        if (resultado.userData.slug && resultado.userData.slug !== id) {
          router.replace(`/perfil/${resultado.userData.slug}`);
        }

        const q = query(
          collection(db, "posts"),
          where("autorId", "==", resultado.uid),
          orderBy("data", "desc")
        );
        const snap = await getDocs(q);
        const lista: any[] = [];
        snap.forEach((d) => lista.push({ id: d.id, ...d.data() }));
        setPosts(lista);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    }
    carregar();
  }, [id]);

  if (loading)
    return (
      <div className="post-detail-loading">
        <div className="spinner" />
        Carregando perfil...
      </div>
    );

  if (!user)
    return <div className="post-detail-notfound">Usuário não encontrado.</div>;

  const nomeExibicao =
    user.titulo && user.nome
      ? `${user.titulo} ${user.nome}`
      : user.nome || "Usuário";

  function getUrlPost(post: any) {
    const tipo = post.tipo === "sermao" ? "sermoes" : "artigos";
    return `${window.location.origin}/posts/${tipo}/${post.slug}`;
  }

  return (
    <div className="perfil-wrapper">

      {/* CARD DO PERFIL */}
      <div className="perfil-card">
        <Avatar src={user.fotoUrl} name={nomeExibicao} size={64} />
        <div className="perfil-info">
          <h1 className="perfil-nome">{nomeExibicao}</h1>
          {user.bio ? (
            <p className="perfil-bio">{user.bio}</p>
          ) : (
            <p className="perfil-bio-vazia">Sem descrição.</p>
          )}
          <div className="perfil-stat">
            <span className="perfil-stat-num">{posts.length}</span>
            <span className="perfil-stat-label">publicações</span>
          </div>
        </div>
      </div>

      {/* PUBLICAÇÕES */}
      <div className="perfil-posts-section">
        <h2 className="perfil-posts-title">Publicações</h2>

        {posts.length === 0 && (
          <div className="empty-state">Nenhuma publicação ainda.</div>
        )}

        <div className="posts-list">
          {posts.map((post) => {
            const urlPost = getUrlPost(post);
            const textoCompartilhar = encodeURIComponent(`${post.titulo} - ${nomeExibicao}`);
            const urlEncoded = encodeURIComponent(urlPost);
            const aberto = compartilharAberto === post.id;
            const navAbertaEste = navAberta === post.id;

            return (
              <div key={post.id} className="post-card">
                <div className="card-header-row">
                  <Avatar src={user.fotoUrl} name={nomeExibicao} size={36} />
                  <div className="author-col">
                    <span className="author-name-link">{nomeExibicao}</span>
                    <span className="card-meta">
                      {post.data?.toDate
                        ? post.data.toDate().toLocaleDateString("pt-BR")
                        : typeof post.data === "string" ? post.data : ""}
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
                      `/posts/${post.tipo === "sermao" ? "sermoes" : "artigos"}/${post.slug}`
                    )
                  }
                  style={{ cursor: "pointer" }}
                >
                  <h3 className="card-title">{post.titulo}</h3>
                  {post.resumo && <p className="card-frase">{post.resumo}</p>}
                </div>

                <div className="card-footer-row">
                  {/* Botão: ver outras publicações deste autor (nav sequencial) */}
                  {posts.length > 1 && (
                    <button
                      className="action-btn"
                      onClick={() => setNavAberta(navAbertaEste ? null : post.id)}
                      title="Ver publicações relacionadas deste autor"
                    >
                      {navAbertaEste ? "Fechar" : "Mais deste autor"}
                    </button>
                  )}

                  <button
                    className="action-btn"
                    onClick={() => setCompartilharAberto(aberto ? null : post.id)}
                  >
                    🔗 Compartilhar
                  </button>

                  <span
                    className="read-link"
                    onClick={() =>
                      router.push(
                        `/posts/${post.tipo === "sermao" ? "sermoes" : "artigos"}/${post.slug}`
                      )
                    }
                  >
                    Ler completo →
                  </span>
                </div>

                {/* Navegação sequencial entre posts do autor */}
                {navAbertaEste && (
                  <div style={{ marginTop: "0.75rem" }}>
                    <PostNavigation posts={posts} postAtualId={post.id} />
                  </div>
                )}

                {/* Opções de compartilhamento */}
                {aberto && (
                  <div className="perfil-share-options">
                    <a
                      href={`https://wa.me/?text=${textoCompartilhar}%20${urlEncoded}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="share-btn share-whatsapp"
                    >
                      WhatsApp
                    </a>
                    <a
                      href={`https://www.facebook.com/sharer/sharer.php?u=${urlEncoded}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="share-btn share-facebook"
                    >
                      Facebook
                    </a>
                    <a
                      href={`https://www.threads.net/intent/post?text=${textoCompartilhar}%20${urlEncoded}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="share-btn share-threads"
                    >
                      Threads
                    </a>
                    <a
                      href={`https://twitter.com/intent/tweet?text=${textoCompartilhar}&url=${urlEncoded}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="share-btn share-twitter"
                    >
                      X (Twitter)
                    </a>
                    <a
                      href={`https://www.linkedin.com/sharing/share-offsite/?url=${urlEncoded}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="share-btn share-linkedin"
                    >
                      LinkedIn
                    </a>
                    <a
                      href={`mailto:?subject=${encodeURIComponent(post.titulo)}&body=${encodeURIComponent(post.conteudo + "\n\n" + urlPost)}`}
                      className="share-btn share-email"
                    >
                      Email
                    </a>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(urlPost);
                        setCopiado(post.id);
                        setTimeout(() => setCopiado(null), 2000);
                      }}
                      className="share-btn share-copy"
                    >
                      {copiado === post.id ? "✓ Copiado!" : "Copiar link"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
