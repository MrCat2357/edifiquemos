"use client";

import { useEffect, useRef, useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  updateDoc,
  arrayUnion,
  arrayRemove,
  increment,
} from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import { gerarPDF } from "@/lib/gerarPDF";

type User = {
  nome?: string;
  titulo?: string;
  bio?: string;
  slug?: string;
  fotoUrl?: string | null;
};

function getInitials(name: string) {
  if (!name) return "?";
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function Avatar({ src, name, size = 64 }: { src?: string | null; name: string; size?: number }) {
  if (src) {
    return (
      <img src={src} alt={name} style={{
        width: size, height: size, borderRadius: "50%", objectFit: "cover",
        flexShrink: 0, boxShadow: size >= 56 ? "0 0 0 3px var(--emerald-dim)" : "none",
      }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "linear-gradient(135deg, var(--emerald-dark), var(--emerald))",
      color: "#fff", fontSize: Math.round(size * 0.36) + "px", fontWeight: 700,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0, userSelect: "none",
      boxShadow: size >= 56 ? "0 0 0 3px var(--emerald-dim)" : "none",
    }}>
      {getInitials(name)}
    </div>
  );
}

function IconHeart({ size = 13, filled = false }: { size?: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M8 13.5C8 13.5 1.5 9.5 1.5 5.5C1.5 3.567 3.067 2 5 2C6.105 2 7.093 2.535 7.75 3.366L8 3.7L8.25 3.366C8.907 2.535 9.895 2 11 2C12.933 2 14.5 3.567 14.5 5.5C14.5 9.5 8 13.5 8 13.5Z"
        stroke="currentColor" strokeWidth="1.4" fill={filled ? "currentColor" : "none"} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconEye({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M1.5 8C3 4.5 5.3 3 8 3s5 1.5 6.5 5C13 11.5 10.7 13 8 13S3 11.5 1.5 8Z" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function IconDownload({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M8 2v7M8 9l-2.5-2.5M8 9l2.5-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
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
  if (docSnap.exists()) return { uid: docSnap.id, userData: docSnap.data() as User };
  return null;
}

function Toast({ msg, visible }: { msg: string; visible: boolean }) {
  return (
    <div style={{
      position: "fixed", bottom: "1.5rem", left: "50%",
      transform: `translateX(-50%) translateY(${visible ? 0 : "12px"})`,
      background: "var(--bg-elevated)", border: "1px solid var(--emerald-dim)",
      color: "var(--emerald)", fontSize: "0.82rem", fontWeight: 600,
      padding: "8px 20px", borderRadius: "var(--radius-full)",
      boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
      opacity: visible ? 1 : 0, transition: "all 0.25s ease",
      pointerEvents: "none", zIndex: 999,
    }}>
      {msg}
    </div>
  );
}

/* ── SerieCardPublico ────────────────────────────────── */

function SerieCardPublico({ serie, index }: { serie: any; index: number }) {
  const router = useRouter();
  const postCount = serie.postIds?.length ?? 0;

  return (
    <article
      className="post-card serie-card"
      style={{ animationDelay: `${index * 60}ms`, cursor: "pointer" }}
      onClick={() => router.push(`/series/${serie.slug}`)}
    >
      {serie.imagemUrl && (
        <div className="card-cover-wrapper">
          <img src={serie.imagemUrl} alt={serie.titulo} className="card-cover-img" />
          <span className="cat-badge card-cover-badge" style={{
            background: "rgba(10,15,10,0.72)", backdropFilter: "blur(6px)",
            color: "var(--emerald)", borderColor: "var(--emerald-dim)",
          }}>
            📚 Série
          </span>
        </div>
      )}
      <div style={{ padding: serie.imagemUrl ? "0.875rem 1.125rem 0.875rem" : undefined }}>
        {!serie.imagemUrl && (
          <div className="card-header-row" style={{ cursor: "default" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ flex: 1 }}>
              <span className="card-meta">{postCount} publicação{postCount !== 1 ? "ões" : ""}</span>
            </div>
            <span className="cat-badge" style={{
              color: "var(--emerald)", background: "var(--emerald-dim)", borderColor: "var(--emerald-dim)",
            }}>
              📚 Série
            </span>
          </div>
        )}

        <div className="card-body-area" style={serie.imagemUrl ? { paddingTop: 0 } : undefined}>
          {serie.imagemUrl && (
            <p className="card-meta" style={{ marginBottom: "0.375rem" }}>
              {postCount} publicação{postCount !== 1 ? "ões" : ""}
            </p>
          )}
          <h2 className="card-title" style={serie.imagemUrl ? { fontSize: "1rem" } : undefined}>
            {serie.titulo}
          </h2>
          {serie.descricao && <p className="card-frase">{serie.descricao}</p>}
        </div>

        <div className="card-footer-row" style={{ display: "flex", alignItems: "center" }}
          onClick={(e) => e.stopPropagation()}>
          <span style={{ fontSize: "0.72rem", color: "var(--text-3)", fontStyle: "italic" }}>
            Coleção temática de sermões e artigos
          </span>
          <span className="read-link" style={{ marginLeft: "auto" }}
            onClick={() => router.push(`/series/${serie.slug}`)}>
            Ver série →
          </span>
        </div>
      </div>
    </article>
  );
}

/* ── PostCardPerfil ─────────────────────────────────── */

function PostCardPerfil({
  post, index, user, nomeExibicao, autorUid, onToast,
}: {
  post: any; index: number; user: User; nomeExibicao: string;
  autorUid: string; onToast: (msg: string) => void;
}) {
  const router = useRouter();
  const currentUid = auth.currentUser?.uid;

  const [liked, setLiked] = useState<boolean>(() =>
    currentUid ? (post.likedBy ?? []).includes(currentUid) : false
  );
  const [likeCount, setLikeCount] = useState<number>(post.likes ?? 0);
  const [loadingLike, setLoadingLike] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [downloadCount, setDownloadCount] = useState<number>(post.downloads ?? 0);

  const viewCount: number = post.visualizacoes ?? 0;
  const temImagem = !!post.imagemUrl;

  const postPath = `/posts/${post.tipo === "sermao" ? "sermoes" : "artigos"}/${post.slug}?from=perfil`;
  const fullUrl = typeof window !== "undefined"
    ? `${window.location.origin}/posts/${post.tipo === "sermao" ? "sermoes" : "artigos"}/${post.slug}`
    : `/posts/${post.tipo === "sermao" ? "sermoes" : "artigos"}/${post.slug}`;

  function buildFrase() {
    const data = post.data?.toDate
      ? post.data.toDate().toLocaleDateString("pt-BR")
      : typeof post.data === "string" ? post.data : "";
    if (post.tipo === "sermao") {
      if (post.igreja && data) return `Pregado na ${post.igreja} · ${data}`;
      if (post.igreja) return `Pregado na ${post.igreja}`;
      if (data) return `Pregado em ${data}`;
      return "";
    }
    return `Por ${nomeExibicao}${data ? ` · ${data}` : ""}`;
  }

  async function handleLike(e: React.MouseEvent) {
    e.stopPropagation();
    if (!currentUid) { onToast("Faça login para curtir"); return; }
    if (loadingLike) return;
    setLoadingLike(true);
    try {
      const postRef = doc(db, "posts", post.id);
      if (liked) {
        await updateDoc(postRef, { likes: increment(-1), likedBy: arrayRemove(currentUid) });
        setLiked(false); setLikeCount((n) => Math.max(0, n - 1));
      } else {
        await updateDoc(postRef, { likes: increment(1), likedBy: arrayUnion(currentUid) });
        setLiked(true); setLikeCount((n) => n + 1);
      }
    } catch (err) { console.error(err); }
    setLoadingLike(false);
  }

  async function handleDownloadPdf(e: React.MouseEvent) {
    e.stopPropagation();
    if (gerandoPdf) return;
    setGerandoPdf(true);
    onToast("Gerando PDF...");
    try {
      await gerarPDF({
        titulo: post.titulo, nomeAutor: nomeExibicao,
        fotoAutor: user.fotoUrl ?? null,
        dataPost: post.data?.toDate ? post.data.toDate().toLocaleDateString("pt-BR") : typeof post.data === "string" ? post.data : "",
        igreja: post.igreja || "",
        conteudo: post.conteudo || "Acesse o link para ler o conteúdo completo:\n" + fullUrl,
        tipo: post.tipo,
        onDownload: async () => {
          try {
            await updateDoc(doc(db, "posts", post.id), { downloads: increment(1) });
            setDownloadCount((n) => n + 1);
          } catch {}
        },
      });
    } catch (err) { console.error(err); onToast("Erro ao gerar PDF."); }
    setGerandoPdf(false);
  }

  const footerRow = (
    <div className="card-footer-row" style={{ display: "flex", alignItems: "center", gap: "0" }}
      onClick={(e) => e.stopPropagation()}>
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <button className={`action-btn ${liked ? "liked" : ""}`} onClick={handleLike}
          disabled={loadingLike}
          title={currentUid ? (liked ? "Remover curtida" : "Curtir") : "Faça login para curtir"}
          style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: 0, background: "none", border: "none" }}>
          <IconHeart size={13} filled={liked} />
          Amei
          {likeCount > 0 && <span style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>{likeCount}</span>}
        </button>

        <button className="action-btn" onClick={handleDownloadPdf} disabled={gerandoPdf}
          title="Baixar como PDF"
          style={{ opacity: gerandoPdf ? 0.6 : 1, display: "inline-flex", alignItems: "center", gap: "4px", padding: 0, background: "none", border: "none" }}>
          {gerandoPdf ? <><span className="btn-spinner" />PDF</> : <><IconDownload size={13} />PDF</>}
          {downloadCount > 0 && (
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-3)" }}
              title={`${downloadCount} download${downloadCount !== 1 ? "s" : ""}`}>
              {downloadCount}
            </span>
          )}
        </button>

        {viewCount > 0 && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "0.72rem", fontWeight: 600, color: "var(--text-3)" }}
            title={`${viewCount} visualização${viewCount !== 1 ? "ões" : ""}`}>
            <IconEye size={13} />{viewCount}
          </span>
        )}
      </div>
      <span className="read-link" style={{ marginLeft: "auto" }} onClick={() => router.push(postPath)}>
        Ler completo →
      </span>
    </div>
  );

  if (temImagem) {
    return (
      <article className="post-card post-card-image" style={{ animationDelay: `${index * 60}ms` }}
        onClick={() => router.push(postPath)}>
        <div className="card-cover-wrapper">
          <img src={post.imagemUrl} alt={post.titulo} className="card-cover-img" />
          <span className={`cat-badge card-cover-badge ${post.tipo === "sermao" ? "cat-sermao" : "cat-artigo"}`}>
            {post.tipo === "sermao" ? "Sermão" : "Artigo"}
          </span>
        </div>
        <div className="card-image-content">
          <div className="card-header-row" style={{ padding: "0.875rem 1.125rem 0.375rem" }}
            onClick={(e) => e.stopPropagation()}>
            <Avatar src={user.fotoUrl} name={nomeExibicao} size={28} />
            <div className="author-col" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <span className="author-name-link" style={{ display: "inline", width: "fit-content", alignSelf: "flex-start", fontSize: "0.8rem", cursor: "default" }}>
                {nomeExibicao}
              </span>
              <span className="card-meta">{buildFrase()}</span>
            </div>
          </div>
          <div className="card-body-area" style={{ padding: "0 1.125rem 0.75rem" }}>
            <h2 className="card-title" style={{ fontSize: "1rem" }}>{post.titulo}</h2>
            {post.resumo && <p className="card-frase">{post.resumo}</p>}
          </div>
          {footerRow}
        </div>
      </article>
    );
  }

  return (
    <article className="post-card" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="card-header-row" onClick={() => router.push(postPath)} style={{ cursor: "pointer" }}>
        <Avatar src={user.fotoUrl} name={nomeExibicao} size={36} />
        <div className="author-col" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <span className="author-name-link" onClick={(e) => e.stopPropagation()}
            style={{ display: "inline", width: "fit-content", alignSelf: "flex-start", cursor: "default" }}>
            {nomeExibicao}
          </span>
          <span className="card-meta">{buildFrase()}</span>
        </div>
        <span className={`cat-badge ${post.tipo === "sermao" ? "cat-sermao" : "cat-artigo"}`}>
          {post.tipo === "sermao" ? "Sermão" : "Artigo"}
        </span>
      </div>
      <div className="card-body-area" onClick={() => router.push(postPath)} style={{ cursor: "pointer" }}>
        <h2 className="card-title">{post.titulo}</h2>
        {post.resumo && <p className="card-frase">{post.resumo}</p>}
      </div>
      {footerRow}
    </article>
  );
}

/* ── PerfilPublico ───────────────────────────────────── */

export default function PerfilPublico() {
  const { id } = useParams();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [series, setSeries] = useState<any[]>([]);
  const [aba, setAba] = useState<"posts" | "series">("posts");
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    setToastMsg(msg);
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2200);
  }

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

        const [postsSnap, seriesSnap] = await Promise.all([
          getDocs(query(
            collection(db, "posts"),
            where("autorId", "==", resultado.uid),
            orderBy("data", "desc")
          )),
          getDocs(query(
            collection(db, "series"),
            where("autorId", "==", resultado.uid),
            orderBy("criadoEm", "desc")
          )),
        ]);

        const listaP: any[] = [];
        postsSnap.forEach((d) => listaP.push({ id: d.id, ...d.data() }));
        setPosts(listaP);

        const listaS: any[] = [];
        seriesSnap.forEach((d) => listaS.push({ id: d.id, ...d.data() }));
        setSeries(listaS);
      } catch (err) { console.error(err); }
      setLoading(false);
    }
    carregar();
  }, [id]);

  if (loading) return <div className="post-detail-loading"><div className="spinner" />Carregando perfil...</div>;
  if (!user) return <div className="post-detail-notfound">Usuário não encontrado.</div>;

  const nomeExibicao =
    user.titulo && user.nome
      ? `${user.titulo} ${user.nome}`
      : user.nome || "Usuário";

  return (
    <>
      <Toast msg={toastMsg} visible={toastVisible} />

      <div className="perfil-wrapper">
        <div className="perfil-card">
          <Avatar src={user.fotoUrl} name={nomeExibicao} size={64} />
          <div className="perfil-info">
            <h1 className="perfil-nome">{nomeExibicao}</h1>
            {user.bio ? <p className="perfil-bio">{user.bio}</p> : <p className="perfil-bio-vazia">Sem descrição.</p>}
            <div style={{ display: "flex", gap: "1.25rem" }}>
              <div className="perfil-stat">
                <span className="perfil-stat-num">{posts.length}</span>
                <span className="perfil-stat-label">publicações</span>
              </div>
              <div className="perfil-stat">
                <span className="perfil-stat-num">{series.length}</span>
                <span className="perfil-stat-label">série{series.length !== 1 ? "s" : ""}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="perfil-posts-section">
          {/* Abas */}
          <div style={{ display: "flex", gap: "0", borderBottom: "1px solid var(--border)", marginBottom: "1.5rem" }}>
            {(["posts", "series"] as const).map((a) => (
              <button
                key={a}
                onClick={() => setAba(a)}
                style={{
                  padding: "0.625rem 1.25rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  background: "none",
                  border: "none",
                  borderBottom: aba === a ? "2px solid var(--emerald)" : "2px solid transparent",
                  color: aba === a ? "var(--emerald)" : "var(--text-3)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  marginBottom: "-1px",
                }}
              >
                {a === "posts"
                  ? `Publicações (${posts.length})`
                  : `Séries (${series.length})`}
              </button>
            ))}
          </div>

          {aba === "posts" && (
            <>
              {posts.length === 0 && <div className="empty-state">Nenhuma publicação ainda.</div>}
              <div className="posts-list">
                {posts.map((post, i) => (
                  <PostCardPerfil
                    key={post.id}
                    post={post}
                    index={i}
                    user={user}
                    nomeExibicao={nomeExibicao}
                    autorUid={uid!}
                    onToast={showToast}
                  />
                ))}
              </div>
            </>
          )}

          {aba === "series" && (
            <>
              {series.length === 0 && (
                <div className="empty-state">Este autor ainda não criou nenhuma série.</div>
              )}
              <div className="posts-list">
                {series.map((serie, i) => (
                  <SerieCardPublico key={serie.id} serie={serie} index={i} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        .post-card-image { cursor: pointer; }
        .card-cover-wrapper {
          position: relative; width: 100%;
          max-height: 420px; min-height: 160px;
          overflow: hidden;
          border-radius: var(--radius-lg) var(--radius-lg) 0 0;
          background: #0d1310;
          display: flex; align-items: center; justify-content: center;
        }
        .card-cover-img {
          width: 100%; height: 100%;
          object-fit: contain; display: block;
          max-height: 420px;
          transition: transform 0.35s ease;
        }
        .post-card-image:hover .card-cover-img { transform: scale(1.025); }
        .serie-card:hover .card-cover-img { transform: scale(1.025); }
        .card-cover-badge {
          position: absolute; top: 0.625rem; right: 0.75rem;
          backdrop-filter: blur(6px);
          background: rgba(10, 15, 10, 0.72) !important;
        }
        .card-image-content { display: flex; flex-direction: column; }
        @media (max-width: 640px) {
          .card-cover-wrapper { max-height: 320px; min-height: 120px; }
          .card-cover-img { max-height: 320px; }
        }
      `}</style>
    </>
  );
}