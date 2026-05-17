"use client";

import { useEffect, useState } from "react";
import { db, auth, storage } from "@/lib/firebase";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useParams, useRouter } from "next/navigation";

export default function EditarSerie() {
  const { id } = useParams();
  const router = useRouter();

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [imagemAtual, setImagemAtual] = useState<string | null>(null);
  const [imagemFile, setImagemFile] = useState<File | null>(null);
  const [imagemPreview, setImagemPreview] = useState<string | null>(null);
  const [slug, setSlug] = useState("");

  const [meusPosts, setMeusPosts] = useState<any[]>([]);
  const [postsSelecionados, setPostsSelecionados] = useState<string[]>([]);
  const [busca, setBusca] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function carregar() {
      if (!id) return;
      const user = auth.currentUser;
      if (!user) { router.push("/login"); return; }

      try {
        const serieSnap = await getDoc(doc(db, "series", id as string));
        if (!serieSnap.exists()) { setError("Série não encontrada."); setLoading(false); return; }

        const data = serieSnap.data();
        if (data.autorId !== user.uid) { setError("Sem permissão para editar."); setLoading(false); return; }

        setTitulo(data.titulo || "");
        setDescricao(data.descricao || "");
        setImagemAtual(data.imagemUrl || null);
        setSlug(data.slug || "");
        setPostsSelecionados(data.postIds || []);

        const q = query(
          collection(db, "posts"),
          where("autorId", "==", user.uid),
          orderBy("data", "desc")
        );
        const snap = await getDocs(q);
        const lista: any[] = [];
        snap.forEach((d) => lista.push({ id: d.id, ...d.data() }));
        setMeusPosts(lista);
      } catch (err) { console.error(err); setError("Erro ao carregar série."); }
      setLoading(false);
    }
    carregar();
  }, [id]);

  function handleImagemChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImagemFile(file);
    setImagemPreview(URL.createObjectURL(file));
  }

  function togglePost(postId: string) {
    setPostsSelecionados((prev) =>
      prev.includes(postId) ? prev.filter((p) => p !== postId) : [...prev, postId]
    );
  }

  const postsFiltrados = meusPosts.filter((p) =>
    p.titulo?.toLowerCase().includes(busca.toLowerCase())
  );

  async function handleSalvar() {
    if (saving) return;
    if (!titulo.trim()) { setError("O título é obrigatório."); return; }
    if (postsSelecionados.length === 0) { setError("Adicione pelo menos um post."); return; }

    const user = auth.currentUser;
    if (!user) return;

    setSaving(true);
    setError("");

    try {
      let imagemUrl = imagemAtual;
      if (imagemFile) {
        const storageRef = ref(storage, `series/${user.uid}/${slug}-${Date.now()}`);
        await uploadBytes(storageRef, imagemFile);
        imagemUrl = await getDownloadURL(storageRef);
      }

      await updateDoc(doc(db, "series", id as string), {
        titulo: titulo.trim().toUpperCase(),
        descricao: descricao.trim() || "",
        imagemUrl: imagemUrl ?? null,
        postIds: postsSelecionados,
      });

      router.push(`/series/${slug}`);
    } catch (err) { console.error(err); setError("Erro ao salvar série."); }
    setSaving(false);
  }

  if (loading) return <div className="post-detail-loading"><div className="spinner" />Carregando...</div>;
  if (error && !titulo) return <div className="post-detail-notfound">{error}</div>;

  const imagemExibida = imagemPreview || imagemAtual;

  return (
    <div style={{ paddingTop: "calc(var(--header-h) + 2rem)", paddingBottom: "4rem" }}>
      <div style={{ maxWidth: "680px", margin: "0 auto", padding: "0 1.25rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>

        <div>
          <h1 style={{ fontSize: "clamp(1.4rem, 3vw, 2rem)", fontWeight: 800, color: "var(--text-1)", letterSpacing: "-0.02em", marginBottom: "0.25rem" }}>
            Editar série
          </h1>
          <p style={{ fontSize: "0.875rem", color: "var(--text-3)" }}>Altere os campos desejados e salve</p>
        </div>

        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "2rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          <div className="auth-field">
            <label className="auth-label">Título da série</label>
            <input placeholder="Ex: Exposição em Efésios" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="auth-input" />
          </div>

          <div className="auth-field">
            <label className="auth-label">Descrição <span className="auth-label-opt">(opcional)</span></label>
            <textarea placeholder="Descreva o tema ou objetivo desta série..." value={descricao} onChange={(e) => setDescricao(e.target.value)} className="auth-input" style={{ minHeight: "5rem", resize: "vertical", lineHeight: 1.65 }} />
          </div>

          <div className="auth-field">
            <label className="auth-label">Imagem de capa <span className="auth-label-opt">(opcional)</span></label>
            {imagemExibida ? (
              <div style={{ position: "relative", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
                <img src={imagemExibida} alt="Preview" style={{ width: "100%", height: "180px", objectFit: "cover", display: "block" }} />
                <button type="button" onClick={() => { setImagemFile(null); setImagemPreview(null); setImagemAtual(null); }}
                  style={{ position: "absolute", top: "8px", right: "8px", background: "rgba(0,0,0,0.7)", border: "none", color: "#fff", borderRadius: "50%", width: "28px", height: "28px", cursor: "pointer", fontSize: "0.85rem", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
              </div>
            ) : (
              <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.5rem", border: "1px dashed var(--border-light)", borderRadius: "var(--radius-lg)", padding: "1.5rem", cursor: "pointer", color: "var(--text-3)", fontSize: "0.85rem" }}>
                <span style={{ fontSize: "1.5rem" }}>🖼</span>
                <span>Clique para escolher uma imagem</span>
                <input type="file" accept="image/*" onChange={handleImagemChange} style={{ display: "none" }} />
              </label>
            )}
          </div>

          <div className="auth-field">
            <label className="auth-label">
              Posts da série
              {postsSelecionados.length > 0 && (
                <span style={{ marginLeft: "0.5rem", fontSize: "0.72rem", color: "var(--emerald)", fontWeight: 600 }}>
                  {postsSelecionados.length} selecionado{postsSelecionados.length !== 1 ? "s" : ""}
                </span>
              )}
            </label>

            <input placeholder="Buscar post..." value={busca} onChange={(e) => setBusca(e.target.value)} className="auth-input" style={{ marginBottom: "0.75rem", fontSize: "0.85rem" }} />

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "320px", overflowY: "auto" }}>
              {postsFiltrados.map((post) => {
                const selecionado = postsSelecionados.includes(post.id);
                return (
                  <div key={post.id} onClick={() => togglePost(post.id)}
                    style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.625rem 0.875rem", borderRadius: "var(--radius-lg)", border: selecionado ? "1px solid var(--emerald)" : "1px solid var(--border-light)", background: selecionado ? "var(--emerald-dim)" : "var(--bg-elevated)", cursor: "pointer", transition: "all 0.15s" }}>
                    <div style={{ width: "18px", height: "18px", borderRadius: "4px", flexShrink: 0, border: selecionado ? "2px solid var(--emerald)" : "2px solid var(--border-light)", background: selecionado ? "var(--emerald)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
                      {selecionado && <span style={{ color: "#fff", fontSize: "0.65rem", fontWeight: 800 }}>✓</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-1)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{post.titulo}</p>
                      <p style={{ fontSize: "0.72rem", color: "var(--text-3)", margin: 0 }}>
                        {post.tipo === "sermao" ? "Sermão" : "Estudo"}
                        {post.data?.toDate ? ` · ${post.data.toDate().toLocaleDateString("pt-BR")}` : typeof post.data === "string" ? ` · ${post.data}` : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {error && <div className="auth-error"><p>{error}</p></div>}

          <button type="button" onClick={handleSalvar} disabled={saving} className="auth-btn-primary" style={{ marginTop: "0.25rem" }}>
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}