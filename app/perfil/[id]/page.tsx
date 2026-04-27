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

export default function PerfilPublico() {
  const { id } = useParams();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [compartilharAberto, setCompartilharAberto] = useState<string | null>(null);

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

            return (
              <div key={post.id} className="post-card">
                <div className="card-header-row">
                  <Avatar src={user.fotoUrl} name={nomeExibicao} size={36} />
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
                  {post.resumo && <p className="card-frase">{post.resumo}</p>}
                </div>

                <div className="card-footer-row">
                  <button
                    className="action-btn"
                    onClick={() =>
                      setCompartilharAberto(aberto ? null : post.id)
                    }
                  >
                    🔗 Compartilhar
                  </button>
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
                      href={`mailto:?subject=${encodeURIComponent(
                        post.titulo
                      )}&body=${encodeURIComponent(
                        post.conteudo + "\n\n" + urlPost
                      )}`}
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
