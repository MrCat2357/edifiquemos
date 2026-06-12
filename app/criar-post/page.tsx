"use client";

import { useEffect, useState, useRef } from "react";
import { db, auth } from "@/lib/firebase";
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { addDoc, collection, doc, getDoc, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { gerarSlugUnico } from "@/lib/slug";
import FileImportButton from "@/components/Button";
import RichTextEditor from "@/components/RichTextEditor";
import SlideCarrossel from "@/components/SlideCarrossel";
import type { LinkReferencia } from "@/components/LinksReferencia";


const TIPO_LINK_OPTIONS: { value: LinkReferencia["tipo"]; label: string; icon: string }[] = [
  { value: "youtube", label: "YouTube",    icon: "▶" },
  { value: "blog",    label: "Blog / Site", icon: "✍" },
  { value: "livro",   label: "Livro",      icon: "📖" },
  { value: "site",    label: "Site",       icon: "🌐" },
  { value: "outro",   label: "Outro",      icon: "🔗" },
];

/* Formatos de slide aceitos */
const SLIDE_EXTENSIONS = ["pptx", "ppt", "odp", "key", "pdf"] as const;
const SLIDE_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // pptx
  "application/vnd.ms-powerpoint",                                              // ppt
  "application/vnd.oasis.opendocument.presentation",                            // odp
  "application/x-iwork-keynote-sffkey",                                         // key
  "application/pdf",                                                             // pdf
];
const SLIDE_MAX_PAGES = 70;
const SLIDE_MAX_MB    = 50;

type SlideExt = (typeof SLIDE_EXTENSIONS)[number];

/* ─── Contagem de páginas PDF client-side ─────────────── */
async function contarPaginasPDF(file: File): Promise<number> {
  // Usa pdf-lib apenas para contar — leve e sem renderização
  const { PDFDocument } = await import("pdf-lib");
  const bytes = await file.arrayBuffer();
  const pdf   = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return pdf.getPageCount();
}

async function getAutorInfo(uid: string): Promise<{ nome: string; foto: string | null }> {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return { nome: "Autor", foto: null };
    const data = snap.data();
    const nome = data?.nome?.trim();
    const titulo = data?.titulo?.trim();
    const foto = data?.fotoUrl ?? null;
    const nomeCompleto = nome && titulo ? `${titulo} ${nome}` : nome || "Autor";
    return { nome: nomeCompleto, foto };
  } catch {
    return { nome: "Autor", foto: null };
  }
}

/* ─── Upload helper (imagem de capa) ────────────────────── */
async function uploadImagem(
  file: File,
  uid: string,
  onProgress: (p: number) => void
): Promise<string> {
  const storage = getStorage();
  const ext  = file.name.split(".").pop() ?? "jpg";
  const path = `capas/${uid}/${Date.now()}.${ext}`;
  const sRef = storageRef(storage, path);
  const task = uploadBytesResumable(sRef, file);

  return new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      reject,
      async () => resolve(await getDownloadURL(task.snapshot.ref))
    );
  });
}

/* ─── Upload helper (slide) ─────────────────────────────── */
async function uploadSlide(
  file: File,
  uid: string,
  postId: string,
  onProgress: (p: number) => void
): Promise<string> {
  const storage = getStorage();
  const ext  = file.name.split(".").pop()?.toLowerCase() ?? "pdf";
  const path = `slides/${uid}/${postId}/original.${ext}`;
  const sRef = storageRef(storage, path);
  const task = uploadBytesResumable(sRef, file);

  return new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      reject,
      async () => resolve(await getDownloadURL(task.snapshot.ref))
    );
  });
}

/* ─── Fire-and-forget TTS generation ────────────────────── */
async function dispararGeracaoAudio(postId: string): Promise<void> {
  try {
    const user = auth.currentUser;
    if (!user) return;
    const idToken = await user.getIdToken();
    fetch("/api/tts/gerar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ postId }),
    }).catch(() => {});
  } catch {}
}

/* ─── Componente de upload de imagem ─────────────────────── */
function ImageUpload({
  value,
  onChange,
  onClear,
}: {
  value: File | null;
  onChange: (f: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!value) { setPreview(null); return; }
    const url = URL.createObjectURL(value);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  function handleFile(f: File) {
    if (!f.type.startsWith("image/")) return;
    if (f.size > 5 * 1024 * 1024) { alert("A imagem deve ter no máximo 5 MB."); return; }
    onChange(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  if (preview) {
    return (
      <div
        style={{
          position: "relative",
          borderRadius: "var(--radius-sm)",
          overflow: "hidden",
          border: "1px solid var(--border-light)",
          background: "#0d1310",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "120px",
        }}
      >
        <img
          src={preview}
          alt="Pré-visualização da capa"
          style={{ width: "100%", maxHeight: "380px", objectFit: "contain", display: "block" }}
        />
        <button
          type="button"
          onClick={onClear}
          title="Remover imagem"
          style={{
            position: "absolute", top: "0.5rem", right: "0.5rem",
            background: "rgba(10,15,10,0.75)", border: "1px solid var(--border-light)",
            color: "var(--text-1)", borderRadius: "var(--radius-full)",
            width: 28, height: 28, cursor: "pointer", fontSize: "0.85rem",
            display: "flex", alignItems: "center", justifyContent: "center",
            backdropFilter: "blur(4px)", transition: "background 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.7)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(10,15,10,0.75)")}
        >✕</button>
        <div
          style={{
            position: "absolute", bottom: "0.5rem", left: "0.5rem",
            background: "rgba(10,15,10,0.72)", border: "1px solid var(--emerald-dim)",
            color: "var(--emerald)", fontSize: "0.68rem", fontWeight: 600,
            padding: "2px 10px", borderRadius: "var(--radius-full)",
            backdropFilter: "blur(4px)",
          }}
        >Imagem de capa</div>
      </div>
    );
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      style={{
        border: `1.5px dashed ${dragOver ? "var(--emerald)" : "var(--border-light)"}`,
        borderRadius: "var(--radius-sm)",
        padding: "1.5rem",
        textAlign: "center",
        cursor: "pointer",
        background: dragOver ? "var(--emerald-glow)" : "var(--bg)",
        transition: "all 0.15s",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.375rem",
      }}
    >
      <span style={{ fontSize: "1.5rem" }}>🖼️</span>
      <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-2)" }}>
        Arraste uma imagem ou <span style={{ color: "var(--emerald)" }}>clique para selecionar</span>
      </span>
      <span style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>
        JPG, PNG ou WEBP · máx. 5 MB · qualquer proporção
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
    </div>
  );
}

/* ─── Componente de importação de slide ──────────────────── */

type SlideStatus =
  | { type: "idle" }
  | { type: "validating" }
  | { type: "ready"; file: File; pages: number | null; formato: SlideExt }
  | { type: "error"; message: string };

function SlideImportButton({
  status,
  onSelect,
  onClear,
}: {
  status: SlideStatus;
  onSelect: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    // Tamanho
    if (file.size > SLIDE_MAX_MB * 1024 * 1024) {
      onSelect(Object.assign(file, { __error: `Arquivo muito grande. Limite: ${SLIDE_MAX_MB} MB.` }));
      return;
    }
    onSelect(file);
  }

  if (status.type === "idle" || status.type === "error") {
    return (
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        title="Importar apresentação de slides"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.35rem",
          padding: "5px 12px",
          borderRadius: "var(--radius-full)",
          border: status.type === "error"
            ? "1px solid rgba(239,68,68,0.6)"
            : "1px solid var(--emerald)",
          background: status.type === "error"
            ? "rgba(239,68,68,0.08)"
            : "var(--emerald-dim)",
          color: status.type === "error" ? "rgb(239,68,68)" : "var(--emerald)",
          fontWeight: 700,
          fontSize: "0.78rem",
          cursor: "pointer",
          transition: "all 0.2s",
          whiteSpace: "nowrap",
        }}
      >
        {status.type === "error" ? (
          "⚠ Tentar novamente"
        ) : (
          <span style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.25, gap: "1px" }}>
            <span>📄 Importar</span>
            <span>pdf do slide</span>
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".pptx,.ppt,.odp,.key,.pdf"
          style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
        />
      </button>
    );
  }

  if (status.type === "validating") {
    return (
      <button
        type="button"
        disabled
        style={{
          display: "flex", alignItems: "center", gap: "0.35rem",
          padding: "5px 12px", borderRadius: "var(--radius-full)",
          border: "1px solid var(--border-light)", background: "var(--bg-elevated)",
          color: "var(--text-3)", fontWeight: 600, fontSize: "0.78rem", opacity: 0.7,
        }}
      >
        <span style={{
          display: "inline-block", width: 10, height: 10,
          border: "2px solid var(--text-3)", borderTopColor: "var(--emerald)",
          borderRadius: "50%", animation: "spin 0.7s linear infinite",
        }} />
        Verificando…
      </button>
    );
  }

  // ready
  const ext = status.formato.toUpperCase();
  const pagesLabel = status.pages !== null ? ` · ${status.pages} pág.` : "";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
      <div
        style={{
          display: "flex", alignItems: "center", gap: "0.4rem",
          padding: "4px 10px", borderRadius: "var(--radius-full)",
          border: "1px solid var(--emerald)", background: "var(--emerald-dim)",
          fontSize: "0.75rem", fontWeight: 700, color: "var(--emerald)",
          maxWidth: "220px", overflow: "hidden",
        }}
      >
        <span style={{ flexShrink: 0 }}>🗂</span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {ext}{pagesLabel}
        </span>
        <span
          style={{
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            color: "var(--text-3)", fontWeight: 400, fontSize: "0.72rem",
          }}
        >
          {status.file.name}
        </span>
      </div>
      <button
        type="button"
        onClick={onClear}
        title="Remover slide"
        style={{
          background: "none", border: "none", color: "var(--text-3)",
          cursor: "pointer", fontSize: "0.85rem", lineHeight: 1,
          padding: "3px 6px", borderRadius: "var(--radius-sm)", transition: "color 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "rgb(239,68,68)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
      >✕</button>
    </div>
  );
}

/* ─── Aviso de erro de slide ─────────────────────────────── */
function SlideErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div
      style={{
        display: "flex", alignItems: "flex-start", gap: "0.625rem",
        background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.35)",
        borderRadius: "var(--radius-sm)", padding: "0.75rem 1rem",
        fontSize: "0.8rem", color: "rgb(239,68,68)", lineHeight: 1.5,
      }}
    >
      <span style={{ flexShrink: 0, fontSize: "1rem" }}>⚠️</span>
      <span style={{ flex: 1 }}>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        style={{ background: "none", border: "none", color: "rgba(239,68,68,0.7)", cursor: "pointer", fontSize: "0.85rem", padding: "0 2px" }}
      >✕</button>
    </div>
  );
}

/* ─── Banner pós-publicação ──────────────────────────────── */
function BannerReflexao({
  slugPublicado,
  onFechar,
  onGerarReflexoes,
}: {
  slugPublicado: { slug: string; tipo: string };
  onFechar: () => void;
  onGerarReflexoes: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
        zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1.25rem", animation: "fadeInOverlay 0.25s ease",
      }}
    >
      <div
        style={{
          background: "var(--bg-card)", border: "1px solid var(--emerald-dim)",
          borderRadius: "var(--radius-lg)", padding: "2rem",
          maxWidth: "460px", width: "100%", position: "relative",
          display: "flex", flexDirection: "column", gap: "1.25rem",
          boxShadow: "0 12px 48px rgba(0,0,0,0.6), 0 0 0 1px var(--emerald-dim)",
          animation: "slideUpCard 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <button
          onClick={onFechar}
          title="Fechar e ver publicação"
          style={{
            position: "absolute", top: "0.875rem", right: "0.875rem",
            background: "none", border: "none", color: "var(--text-3)",
            fontSize: "1rem", cursor: "pointer", lineHeight: 1,
            padding: "4px 7px", borderRadius: "var(--radius-sm)", transition: "color 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-1)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
        >✕</button>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.625rem", textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", lineHeight: 1, filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.4))" }}>🎉</div>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--text-1)", letterSpacing: "-0.025em", margin: 0 }}>
            Publicação feita com sucesso!
          </h2>
        </div>
        <p style={{ fontSize: "0.875rem", color: "var(--text-2)", lineHeight: 1.7, textAlign: "center", margin: 0 }}>
          Que tal gerar{" "}
          <strong style={{ color: "var(--text-1)" }}>reflexões edificantes</strong> a partir
          dela? São formatos prontos para compartilhar com sua igreja e amigos nas redes sociais
          ao longo da semana.
        </p>
        <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-sm)", padding: "0.875rem 1rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--emerald)", marginBottom: "0.125rem", letterSpacing: "0.02em", textTransform: "uppercase" }}>
            Cada reflexão inclui
          </span>
          {[
            ["🖼", "Imagem gerada automaticamente"],
            ["❓", "Pergunta instigadora"],
            ["📖", "Texto curto (1 min de leitura)"],
            ["🔗", "Link direto para sua publicação"],
          ].map(([icon, label]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", color: "var(--text-2)" }}>
              <span style={{ flexShrink: 0 }}>{icon}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>
        <button onClick={onGerarReflexoes} className="btn-hero-primary" style={{ textAlign: "center", fontSize: "0.95rem", padding: "13px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
          <span>✦</span>
          Gerar reflexões agora
        </button>
        <button onClick={onFechar} style={{ background: "none", border: "none", color: "var(--text-3)", fontSize: "0.8rem", cursor: "pointer", textAlign: "center", textDecoration: "underline", textUnderlineOffset: "3px", padding: 0, transition: "color 0.15s" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-2)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
        >
          Agora não, ver minha publicação →
        </button>
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────── */

export default function CriarPost() {
  const router = useRouter();

  const [titulo,   setTitulo]   = useState("");
  const [conteudo, setConteudo] = useState("");
  const [tipo,     setTipo]     = useState("sermao");
  const [igreja,   setIgreja]   = useState("");
  const [data,     setData]     = useState("");
  const [links,    setLinks]    = useState<LinkReferencia[]>([]);

  /* imagem de capa */
  const [imagemFile,     setImagemFile]     = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  /* slide */
  const [slideStatus,         setSlideStatus]         = useState<SlideStatus>({ type: "idle" });
  const [slideUploadProgress, setSlideUploadProgress] = useState<number | null>(null);

  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [mostrarAviso, setMostrarAviso] = useState(false);

  const [corrigindo,           setCorrigindo]           = useState(false);
  const [mostrarBotaoCorrigir, setMostrarBotaoCorrigir] = useState(false);
  const [correcaoFeita,        setCorrecaoFeita]        = useState(false);

  /* banner pós-publicação */
  const [mostrarBannerReflexao, setMostrarBannerReflexao] = useState(false);
  const [slugPublicado, setSlugPublicado] = useState<{ slug: string; tipo: string } | null>(null);

  /* ── Validação de publicação ── */
  const textoPlain = conteudo.replace(/<[^>]*>/g, "").trim();
  const temConteudo = textoPlain.length > 0;
  const temSlide    = slideStatus.type === "ready";
  const podePublicar = titulo.trim().length > 0 && (temConteudo || temSlide);

  /* ── Draft session storage ── */
  useEffect(() => {
    const draft = sessionStorage.getItem("draft-post");
    if (draft) {
      const d = JSON.parse(draft);
      setTitulo(d.titulo   || "");
      setConteudo(d.conteudo || "");
      setTipo(d.tipo     || "sermao");
      setIgreja(d.igreja  || "");
      setData(d.data    || "");
      setLinks(d.links   || []);
    }
  }, []);

  useEffect(() => {
    setMostrarBotaoCorrigir(textoPlain.length > 20);
    setCorrecaoFeita(false);
  }, [conteudo]);

  /* ── Links helpers ── */
  function addLink()    { setLinks((p) => [...p, { label: "", url: "", tipo: "youtube" }]); }
  function removeLink(i: number) { setLinks((p) => p.filter((_, idx) => idx !== i)); }
  function updateLink(i: number, field: keyof LinkReferencia, value: string) {
    setLinks((p) => p.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));
  }

  /* ── Slide helpers ── */
  async function handleSlideSelect(file: File) {
    // Validar extensão
    const ext = file.name.split(".").pop()?.toLowerCase() as SlideExt | undefined;
    if (!ext || !SLIDE_EXTENSIONS.includes(ext as SlideExt)) {
      setSlideStatus({ type: "error", message: "Formato não suportado. Use .pptx, .ppt, .odp, .key ou .pdf." });
      return;
    }

    // Validar tamanho
    if (file.size > SLIDE_MAX_MB * 1024 * 1024) {
      setSlideStatus({ type: "error", message: `Arquivo muito grande. O limite é ${SLIDE_MAX_MB} MB.` });
      return;
    }

    // Para PDF: contar páginas client-side
    if (ext === "pdf") {
      setSlideStatus({ type: "validating" });
      try {
        const pages = await contarPaginasPDF(file);
        if (pages > SLIDE_MAX_PAGES) {
          setSlideStatus({
            type: "error",
            message: `Este PDF tem ${pages} páginas, mas o limite é ${SLIDE_MAX_PAGES}. Reduza o número de slides antes de importar.`,
          });
          return;
        }
        setSlideStatus({ type: "ready", file, pages, formato: "pdf" });
      } catch {
        // Se falhar a leitura, aceita mesmo assim (pode ser PDF complexo)
        setSlideStatus({ type: "ready", file, pages: null, formato: "pdf" });
      }
      return;
    }

    // Para outros formatos: aceitar com aviso de validação server-side
    setSlideStatus({
      type: "ready",
      file,
      pages: null, // validado no servidor
      formato: ext as SlideExt,
    });
  }

  function handleSlideClear() {
    setSlideStatus({ type: "idle" });
  }

  /* ── Correção gramatical ── */
  async function corrigirGramatica() {
    if (!conteudo.trim() || corrigindo) return;
    setCorrigindo(true);
    try {
      const res  = await fetch("/api/corrigir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conteudo }),
      });
      const json = await res.json();
      if (json?.texto) { setConteudo(json.texto); setCorrecaoFeita(true); }
    } catch (err) { console.error("Erro ao corrigir:", err); }
    setCorrigindo(false);
  }

  /* ── Submit ── */
  async function handleCriarPost(e: React.FormEvent) {
    e.preventDefault();
    if (loading || !podePublicar) return;

    const user = auth.currentUser;

    sessionStorage.setItem(
      "draft-post",
      JSON.stringify({ titulo, conteudo, tipo, igreja, data, links })
    );

    if (!user) { setMostrarAviso(true); return; }

    setLoading(true);
    setError("");

    try {
      const { nome: autorNome, foto: autorFoto } = await getAutorInfo(user.uid);
      const slug = await gerarSlugUnico(autorNome, titulo);
      const linksFiltrados = links.filter((l) => l.label.trim() && l.url.trim());

      /* 1. Upload opcional da imagem de capa */
      let imagemUrl: string | null = null;
      if (imagemFile) {
        setUploadProgress(0);
        imagemUrl = await uploadImagem(imagemFile, user.uid, setUploadProgress);
        setUploadProgress(null);
      }

      /* 2. Criar o documento no Firestore */
      const docRef = await addDoc(collection(db, "posts"), {
        titulo:      titulo.trim().toUpperCase(),
        conteudo:    conteudo.trim(),
        tipo,
        igreja:      igreja.trim()  || "",
        data:        data.trim()    || "",
        autorId:     user.uid,
        autorNome,
        autorFoto:   autorFoto ?? null,
        slug,
        links:       linksFiltrados,
        imagemUrl:   imagemUrl ?? null,
        audioStatus: "none",
        // Campos de slide — serão preenchidos com updateDoc logo abaixo se houver arquivo
        slideArquivoUrl: null,
        slideFormato:    null,
      });

      /* 3. Upload do slide (agora temos o postId) e updateDoc */
      if (slideStatus.type === "ready") {
        setSlideUploadProgress(0);
        const slideUrl = await uploadSlide(
          slideStatus.file,
          user.uid,
          docRef.id,
          setSlideUploadProgress
        );
        setSlideUploadProgress(null);

        await updateDoc(docRef, {
          slideArquivoUrl: slideUrl,
          slideFormato:    slideStatus.formato,
        });


        if (slideStatus.type === "ready") {
          const idToken = await user.getIdToken();
          fetch("/api/slides/converter", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              postId:          docRef.id,
              slideArquivoUrl: slideUrl,
              slideFormato:    slideStatus.formato,
            }),
          }).catch(() => {}); // fire-and-forget
        }
      }

      sessionStorage.removeItem("draft-post");

      /* 4. Fire-and-forget TTS */
      dispararGeracaoAudio(docRef.id);

      setSlugPublicado({ slug, tipo });
      setMostrarBannerReflexao(true);
      setLoading(false);
      return;
    } catch (err) {
      console.error(err);
      setError("Erro ao publicar. Tente novamente.");
      setUploadProgress(null);
      setSlideUploadProgress(null);
    }

    setLoading(false);
  }

  /* ── Label do botão Publicar ── */
  function labelBotao() {
    if (!loading) return "Publicar";
    if (uploadProgress !== null)      return `Enviando imagem… ${uploadProgress}%`;
    if (slideUploadProgress !== null) return `Enviando slide… ${slideUploadProgress}%`;
    return "Publicando…";
  }

  /* ── Handlers do banner ── */
  function handleFecharBanner() {
    if (!slugPublicado) return;
    router.push(
      `/posts/${slugPublicado.tipo === "sermao" ? "sermoes" : "estudos"}/${slugPublicado.slug}`
    );
  }

  function handleGerarReflexoes() {
    router.push("/perfil?aba=reflexoes");
  }

  /* ─────────────────────────────────────────────────────── */

  return (
    <div style={{ paddingTop: "calc(var(--header-h) + 2rem)", paddingBottom: "4rem" }}>

      {/* Banner pós-publicação */}
      {mostrarBannerReflexao && slugPublicado && (
        <BannerReflexao
          slugPublicado={slugPublicado}
          onFechar={handleFecharBanner}
          onGerarReflexoes={handleGerarReflexoes}
        />
      )}

      <div
        style={{
          maxWidth: "680px",
          margin: "0 auto",
          padding: "0 1.25rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        }}
      >
        {/* Cabeçalho */}
        <div>
          <h1
            style={{
              fontSize: "clamp(1.4rem, 3vw, 2rem)",
              fontWeight: 800,
              color: "var(--text-1)",
              letterSpacing: "-0.02em",
              marginBottom: "0.25rem",
            }}
          >
            Publicar conteúdo
          </h1>
          <p style={{ fontSize: "0.875rem", color: "var(--text-3)" }}>
            Compartilhe um sermão ou estudo com a comunidade
          </p>
        </div>

        {/* Aviso de login */}
        {mostrarAviso && (
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--emerald-dim)",
              borderRadius: "var(--radius-lg)",
              padding: "1.5rem",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              gap: "0.875rem",
            }}
          >
            <p style={{ color: "var(--text-2)", fontSize: "0.9rem" }}>
              Para publicar, você precisa criar uma conta.
            </p>
            <button
              onClick={() => router.push("/entrar")}
              className="btn-hero-primary"
              style={{ alignSelf: "center" }}
            >
              Criar conta agora
            </button>
          </div>
        )}

        {/* Card do formulário */}
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: "2rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
          {/* Tipo */}
          <div className="auth-field">
            <label className="auth-label">Tipo de conteúdo</label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {(["sermao", "artigo"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    borderRadius: "var(--radius-full)",
                    border: tipo === t ? "1px solid var(--emerald)" : "1px solid var(--border-light)",
                    background: tipo === t ? "var(--emerald)" : "var(--bg-elevated)",
                    color: tipo === t ? "#fff" : "var(--text-2)",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {t === "sermao" ? "Sermão" : "Estudo"}
                </button>
              ))}
            </div>
          </div>

          {/* Título */}
          <div className="auth-field">
            <label className="auth-label">Título</label>
            <input
              placeholder="Ex: A graça de Deus em Romanos 8"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="auth-input"
            />
          </div>

          {/* Imagem de capa */}
          <div className="auth-field">
            <label className="auth-label">
              Imagem de capa{" "}
              <span className="auth-label-opt">(opcional)</span>
            </label>
            <p style={{ fontSize: "0.72rem", color: "var(--text-3)", marginBottom: "0.5rem" }}>
              Quando presente, o card terá um visual diferenciado com a imagem em destaque
            </p>
            <ImageUpload
              value={imagemFile}
              onChange={setImagemFile}
              onClear={() => setImagemFile(null)}
            />
            {uploadProgress !== null && (
              <div style={{ marginTop: "0.5rem" }}>
                <div style={{ height: 4, background: "var(--border-light)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${uploadProgress}%`, background: "var(--emerald)", borderRadius: "var(--radius-full)", transition: "width 0.2s ease" }} />
                </div>
                <p style={{ fontSize: "0.72rem", color: "var(--text-3)", marginTop: "0.25rem" }}>
                  Enviando imagem… {uploadProgress}%
                </p>
              </div>
            )}
          </div>

          {/* ── Conteúdo (editor rico) ── */}
          <div className="auth-field">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "0.5rem",
                marginBottom: "0.375rem",
              }}
            >
              <label className="auth-label" style={{ margin: 0 }}>
                Conteúdo
              </label>

              {/* Barra de ações do conteúdo */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>

                {/* Botão importar arquivo existente */}
                <FileImportButton
                  onImport={(texto) =>
                    setConteudo((prev) =>
                      prev.replace(/<[^>]*>/g, "").trim()
                        ? prev + "<br><br>" + texto
                        : texto
                    )
                  }
                />

                {/* Botão importar slide */}
                <SlideImportButton
                  status={slideStatus}
                  onSelect={handleSlideSelect}
                  onClear={handleSlideClear}
                />

                {/* Botão corrigir gramática */}
                {mostrarBotaoCorrigir && (
                  <button
                    type="button"
                    onClick={corrigirGramatica}
                    disabled={corrigindo}
                    title="Corrigir erros de gramática e ortografia com IA"
                    style={{
                      display: "flex", alignItems: "center", gap: "0.35rem",
                      padding: "5px 12px", borderRadius: "var(--radius-full)",
                      border: correcaoFeita ? "1px solid var(--emerald)" : "1px solid var(--border-light)",
                      background: correcaoFeita ? "var(--emerald-dim)" : "var(--bg-elevated)",
                      color: correcaoFeita ? "var(--emerald)" : "var(--text-2)",
                      fontWeight: 600, fontSize: "0.78rem",
                      cursor: corrigindo ? "wait" : "pointer",
                      transition: "all 0.2s", whiteSpace: "nowrap",
                      opacity: corrigindo ? 0.7 : 1,
                    }}
                  >
                    {corrigindo ? (
                      <>
                        <span style={{ display: "inline-block", width: "10px", height: "10px", border: "2px solid var(--text-3)", borderTopColor: "var(--emerald)", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                        Corrigindo...
                      </>
                    ) : correcaoFeita ? (
                      <>✓ Corrigido</>
                    ) : (
                      <>✦ Corrigir texto</>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Aviso de erro de slide (abaixo da barra de ações, acima do editor) */}
            {slideStatus.type === "error" && (
              <SlideErrorBanner
                message={slideStatus.message}
                onDismiss={() => setSlideStatus({ type: "idle" })}
              />
            )}

            {/* Aviso non-blocking para formatos não-PDF (validação server-side) */}
            {slideStatus.type === "ready" && slideStatus.formato !== "pdf" && (
              <div
                style={{
                  display: "flex", alignItems: "flex-start", gap: "0.5rem",
                  background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.3)",
                  borderRadius: "var(--radius-sm)", padding: "0.625rem 0.875rem",
                  fontSize: "0.78rem", color: "rgba(234,179,8,0.9)", lineHeight: 1.5,
                  marginBottom: "0.25rem",
                }}
              >
                <span style={{ flexShrink: 0 }}>ℹ️</span>
                <span>
                  A contagem de páginas de arquivos <strong>.{slideStatus.formato}</strong> será verificada pelo servidor após a publicação. Se exceder {SLIDE_MAX_PAGES} páginas, o slide não será processado.
                </span>
              </div>
            )}

            {/* Editor rico */}
            <RichTextEditor
              value={conteudo}
              onChange={setConteudo}
              placeholder={
                temSlide
                  ? "Conteúdo opcional quando há slide anexado. Adicione notas, resumo ou texto complementar…"
                  : "Escreva seu sermão ou estudo aqui, ou importe um arquivo acima…"
              }
              minHeight="14rem"
            />


            {/* ── Prévia do slide ── */}
            {slideStatus.type === "ready" && (
              <div style={{ marginTop: "0.75rem" }}>
                <p style={{
                  fontSize: "0.72rem", fontWeight: 600,
                  color: "var(--emerald)", marginBottom: "0.5rem",
                  textTransform: "uppercase", letterSpacing: "0.04em",
                }}>
                  Prévia do slide
                </p>
                <SlideCarrossel
                  fonte={slideStatus.file}
                  altura={420}
                />
              </div>
            )}


            {/* Hint: conteúdo opcional quando slide presente */}
            {temSlide && !temConteudo && (
              <p style={{ fontSize: "0.72rem", color: "var(--text-3)", marginTop: "0.375rem" }}>
                ✓ Slide importado — o conteúdo de texto é opcional.
              </p>
            )}

            {/* Progress bar do upload de slide */}
            {slideUploadProgress !== null && (
              <div style={{ marginTop: "0.5rem" }}>
                <div style={{ height: 4, background: "var(--border-light)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${slideUploadProgress}%`, background: "var(--emerald)", borderRadius: "var(--radius-full)", transition: "width 0.2s ease" }} />
                </div>
                <p style={{ fontSize: "0.72rem", color: "var(--text-3)", marginTop: "0.25rem" }}>
                  Enviando slide… {slideUploadProgress}%
                </p>
              </div>
            )}
          </div>

          {/* Igreja e Data */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div className="auth-field">
              <label className="auth-label">
                Igreja <span className="auth-label-opt">(opcional)</span>
              </label>
              <input
                placeholder="Nome da igreja"
                value={igreja}
                onChange={(e) => setIgreja(e.target.value)}
                className="auth-input"
              />
            </div>
            <div className="auth-field">
              <label className="auth-label">
                Data <span className="auth-label-opt">(opcional)</span>
              </label>
              <input
                type="text"
                placeholder="Ex: 2025, Século XVI…"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="auth-input"
              />
            </div>
          </div>

          {/* Links de Referência */}
          <div className="auth-field">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "0.5rem",
              }}
            >
              <div>
                <label className="auth-label" style={{ margin: 0 }}>
                  Links de referência{" "}
                  <span className="auth-label-opt">(opcional)</span>
                </label>
                <p style={{ fontSize: "0.72rem", color: "var(--text-3)", marginTop: "2px" }}>
                  YouTube, blog, livro, site… aparecem como botões visuais no post
                </p>
              </div>
              <button
                type="button"
                onClick={addLink}
                style={{
                  display: "flex", alignItems: "center", gap: "0.3rem",
                  padding: "5px 12px", borderRadius: "var(--radius-full)",
                  border: "1px solid var(--border-light)", background: "var(--bg-elevated)",
                  color: "var(--emerald)", fontWeight: 600, fontSize: "0.78rem",
                  cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s",
                }}
              >+ Adicionar</button>
            </div>

            {links.length === 0 && (
              <div
                style={{
                  border: "1px dashed var(--border-light)", borderRadius: "var(--radius-lg)",
                  padding: "1.25rem", textAlign: "center", color: "var(--text-3)", fontSize: "0.82rem",
                }}
              >
                Nenhum link adicionado ainda.{" "}
                <span style={{ color: "var(--emerald)", cursor: "pointer", fontWeight: 600 }} onClick={addLink}>
                  Clique em "+ Adicionar"
                </span>{" "}
                para inserir um link de referência.
              </div>
            )}

            {links.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {links.map((link, i) => (
                  <div
                    key={i}
                    style={{
                      background: "var(--bg-elevated)", border: "1px solid var(--border-light)",
                      borderRadius: "var(--radius-lg)", padding: "0.875rem 1rem",
                      display: "flex", flexDirection: "column", gap: "0.625rem",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <label style={{ fontSize: "0.72rem", color: "var(--text-3)", fontWeight: 600, marginRight: "0.25rem" }}>
                        Tipo:
                      </label>
                      <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap", flex: 1 }}>
                        {TIPO_LINK_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => updateLink(i, "tipo", opt.value)}
                            style={{
                              padding: "3px 10px", borderRadius: "var(--radius-full)",
                              border: link.tipo === opt.value ? "1px solid var(--emerald)" : "1px solid var(--border-light)",
                              background: link.tipo === opt.value ? "var(--emerald-dim)" : "var(--bg-card)",
                              color: link.tipo === opt.value ? "var(--emerald)" : "var(--text-3)",
                              fontSize: "0.72rem", fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                            }}
                          >
                            {opt.icon} {opt.label}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLink(i)}
                        style={{
                          background: "none", border: "none", color: "var(--text-3)",
                          cursor: "pointer", fontSize: "1rem", padding: "2px 6px",
                          borderRadius: "var(--radius-sm)", transition: "color 0.15s", flexShrink: 0,
                        }}
                        title="Remover link"
                      >✕</button>
                    </div>
                    <input
                      placeholder={
                        link.tipo === "youtube" ? "Ex: Acompanhe meu canal no YouTube" :
                        link.tipo === "blog"    ? "Ex: Veja o conteúdo completo no meu blog" :
                        link.tipo === "livro"   ? "Ex: Adquira já seu exemplar do livro" :
                        link.tipo === "site"    ? "Ex: Acesse nosso site" :
                        "Ex: Veja mais conteúdo aqui"
                      }
                      value={link.label}
                      onChange={(e) => updateLink(i, "label", e.target.value)}
                      className="auth-input"
                      style={{ fontSize: "0.85rem", padding: "8px 12px" }}
                    />
                    <input
                      placeholder="https://..."
                      value={link.url}
                      onChange={(e) => updateLink(i, "url", e.target.value)}
                      className="auth-input"
                      style={{ fontSize: "0.82rem", padding: "8px 12px", color: "var(--text-3)" }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Erro */}
          {error && (
            <div className="auth-error">
              <p>{error}</p>
            </div>
          )}

          {/* Botão publicar */}
          <button
            type="button"
            onClick={handleCriarPost}
            disabled={loading || !podePublicar}
            className="auth-btn-primary"
            style={{
              marginTop: "0.25rem",
              opacity: podePublicar ? 1 : 0.45,
              cursor: podePublicar ? "pointer" : "not-allowed",
              transition: "opacity 0.2s",
            }}
          >
            {labelBotao()}
          </button>

          {/* Hint abaixo do botão quando bloqueado */}
          {!podePublicar && titulo.trim().length === 0 && (
            <p style={{ fontSize: "0.72rem", color: "var(--text-3)", textAlign: "center", marginTop: "-0.5rem" }}>
              Preencha o título para publicar.
            </p>
          )}
          {!podePublicar && titulo.trim().length > 0 && !temConteudo && !temSlide && (
            <p style={{ fontSize: "0.72rem", color: "var(--text-3)", textAlign: "center", marginTop: "-0.5rem" }}>
              Adicione um conteúdo ou importe um slide para publicar.
            </p>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeInOverlay { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUpCard {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>
    </div>
  );
}