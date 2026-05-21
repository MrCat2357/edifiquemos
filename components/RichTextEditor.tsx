"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

/* ─── Tipos ─────────────────────────────────────────── */

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

/* ─── Upload para Firebase Storage ─────────────────── */

async function uploadImageToStorage(file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const storageRef = ref(storage, `post-images/${filename}`);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
}

/* ─── Sanitizador ───────────────────────────────────── */

const ALLOWED_TAGS = new Set(["b","strong","i","em","u","br","div","p","span","img"]);

function sanitizeHtml(raw: string): string {
  if (typeof window === "undefined") return raw;
  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, "text/html");

  function clean(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) return;
    if (node.nodeType !== Node.ELEMENT_NODE) { node.parentNode?.removeChild(node); return; }
    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    if (!ALLOWED_TAGS.has(tag)) {
      const frag = document.createDocumentFragment();
      while (el.firstChild) frag.appendChild(el.firstChild);
      el.parentNode?.replaceChild(frag, el);
      frag.childNodes.forEach(clean);
      return;
    }

    const attrs = Array.from(el.attributes);
    for (const attr of attrs) {
      if (tag === "img") {
        if (attr.name === "src" || attr.name === "alt") continue;
        if (attr.name === "style") {
          const allowed = attr.value.match(/(max-width|width|height)\s*:\s*[^;]+/gi);
          if (allowed) el.setAttribute("style", allowed.join("; "));
          else el.removeAttribute("style");
          continue;
        }
        el.removeAttribute(attr.name);
      } else {
        if (attr.name === "style") {
          const alignMatch = attr.value.match(/text-align\s*:\s*(left|center|right|justify)/i);
          if (alignMatch) el.setAttribute("style", `text-align: ${alignMatch[1]}`);
          else el.removeAttribute("style");
        } else {
          el.removeAttribute(attr.name);
        }
      }
    }
    el.childNodes.forEach(clean);
  }

  doc.body.childNodes.forEach(clean);

  // Remove white-space inline que o Chrome mobile injeta no contentEditable
  doc.body.querySelectorAll("[style]").forEach((el) => {
    const cleaned = (el.getAttribute("style") ?? "")
      .replace(/white-space\s*:\s*[^;]+;?\s*/gi, "")
      .trim()
      .replace(/;$/, "");
    if (cleaned) el.setAttribute("style", cleaned);
    else el.removeAttribute("style");
  });

  return doc.body.innerHTML;
}

/* ─── Emojis por categoria ──────────────────────────── */

const EMOJI_CATEGORIES: { label: string; icon: string; emojis: string[] }[] = [
  {
    label: "Fé",
    icon: "✝️",
    emojis: [
      "🙏","✝️","✨","📖","🕊️","⛪","🔥","💫","🌟","⭐",
      "🌙","☀️","🌈","🕯️","💒","❤️","💛","💚","💙","💜",
      "🤍","🌿","🌺","🌸","🍃","🌱","🌻","🌹","🫶","🎺",
    ],
  },
  {
    label: "Expressões",
    icon: "😊",
    emojis: [
      "😊","😄","😁","😢","😭","😔","😤","😮","😇","🙂",
      "😍","🥰","😌","🤗","🤔","🤩","😎","😅","🤣","😂",
      "😑","😶","🤐","😴","🤧","😷","🙁","😞","😬","🤯",
    ],
  },
  {
    label: "Mãos",
    icon: "👐",
    emojis: [
      "👆","☝️","👇","👉","👈","🙌","👐","👏","🤝","🙏",
      "👍","👎","✋","🖐️","🤚","💪","🤜","🤛","✊","👊",
      "🤙","👋","🤞","🖖","✌️","🤘","🤟","👌","🤌","🤏",
    ],
  },
  {
    label: "Natureza",
    icon: "🌿",
    emojis: [
      "🌿","🌳","🌲","🌴","🌵","🍀","🌾","🌊","🏔️","🌄",
      "🌅","🌌","⛅","🌤️","🌦️","❄️","🔥","💧","🌍","🌎",
      "🌏","🐦","🦋","🐑","🦁","🐟","🌷","🌼","🍁","🍂",
    ],
  },
  {
    label: "Símbolos",
    icon: "✅",
    emojis: [
      "✅","❌","⚠️","💡","📌","📍","🔑","🗝️","⚡","🎯",
      "🏆","🎖️","📜","📋","✏️","📝","🔖","📣","📢","🔔",
      "🔕","💬","💭","🗣️","👁️","🔍","🔎","♾️","🔄","⏳",
    ],
  },
];

/* ─── Picker de Emojis ──────────────────────────────── */

function EmojiPicker({
  onSelect,
  onClose,
  anchorRef,
}: {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement>;
}) {
  const [catIdx, setCatIdx] = useState(0);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const pickerH = 300;
    const pickerW = 300;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < pickerH + 8;
    const top = openUp ? rect.top - pickerH - 6 : rect.bottom + 6;
    const left = Math.min(rect.left, window.innerWidth - pickerW - 8);
    setPos({ top, left });
  }, []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        pickerRef.current && !pickerRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) onClose();
    }
    const t = setTimeout(() => document.addEventListener("mousedown", handler), 100);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", handler); };
  }, [onClose]);

  if (!pos) return null;

  const cat = EMOJI_CATEGORIES[catIdx];

  return (
    <div
      ref={pickerRef}
      style={{
        position: "fixed", top: pos.top, left: pos.left, width: 300,
        background: "var(--bg-card)", border: "1px solid var(--border-light)",
        borderRadius: "var(--radius-lg)", boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
        zIndex: 9999, overflow: "hidden", display: "flex", flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", borderBottom: "1px solid var(--border-light)", background: "var(--bg-elevated)" }}>
        {EMOJI_CATEGORIES.map((c, i) => (
          <button
            key={c.label} type="button" title={c.label}
            onMouseDown={(e) => { e.preventDefault(); setCatIdx(i); }}
            style={{
              flex: 1, padding: "7px 0", fontSize: "1rem", border: "none",
              borderBottom: catIdx === i ? "2px solid var(--emerald)" : "2px solid transparent",
              background: "transparent", cursor: "pointer",
              transition: "border-color 0.15s", lineHeight: 1,
            }}
          >
            {c.icon}
          </button>
        ))}
      </div>

      <div style={{
        padding: "5px 10px 3px", fontSize: "0.68rem", fontWeight: 700,
        letterSpacing: "0.06em", textTransform: "uppercase",
        color: "var(--emerald)", background: "var(--bg-elevated)",
      }}>
        {cat.label}
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(8, 1fr)",
        gap: "2px", padding: "8px", maxHeight: 210, overflowY: "auto",
      }}>
        {cat.emojis.map((emoji) => (
          <button
            key={emoji} type="button" title={emoji}
            onMouseDown={(e) => { e.preventDefault(); onSelect(emoji); }}
            style={{
              fontSize: "1.25rem", lineHeight: 1, padding: "5px 2px",
              border: "1px solid transparent", borderRadius: "var(--radius-sm)",
              background: "transparent", cursor: "pointer",
              transition: "background 0.1s", display: "flex",
              alignItems: "center", justifyContent: "center",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-elevated)"; e.currentTarget.style.borderColor = "var(--border-light)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Ícones SVG ────────────────────────────────────── */

function Icon({ type }: { type: string }) {
  const s: React.CSSProperties = {
    width: 15, height: 15, display: "block",
    stroke: "currentColor", fill: "none",
    strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round",
  };
  if (type === "bold") return <svg viewBox="0 0 24 24" style={s}><path d="M6 4h8a4 4 0 010 8H6z"/><path d="M6 12h9a4 4 0 010 8H6z"/></svg>;
  if (type === "italic") return <svg viewBox="0 0 24 24" style={s}><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>;
  if (type === "underline") return <svg viewBox="0 0 24 24" style={s}><path d="M6 3v7a6 6 0 0012 0V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>;
  if (type === "left") return <svg viewBox="0 0 24 24" style={s}><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>;
  if (type === "center") return <svg viewBox="0 0 24 24" style={s}><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>;
  if (type === "justify") return <svg viewBox="0 0 24 24" style={s}><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>;
  if (type === "image") return (
    <svg viewBox="0 0 24 24" style={s}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  );
  return null;
}

/* ─── Botões da toolbar ─────────────────────────────── */

const TOOLBAR_BUTTONS: { command: string; title: string; icon: string }[] = [
  { command: "bold",          title: "Negrito (Ctrl+B)",    icon: "bold" },
  { command: "italic",        title: "Itálico (Ctrl+I)",    icon: "italic" },
  { command: "underline",     title: "Sublinhado (Ctrl+U)", icon: "underline" },
  { command: "justifyLeft",   title: "Alinhar à esquerda",  icon: "left" },
  { command: "justifyCenter", title: "Centralizar",          icon: "center" },
  { command: "justifyFull",   title: "Justificar",           icon: "justify" },
];

/* ─── Toolbar ───────────────────────────────────────── */

function ToolbarContent({
  onCmd, emojiAnchorRef, emojiOpen, onToggleEmoji,
  onInsertImage, uploading, showShortcuts,
}: {
  onCmd: (cmd: string) => void;
  emojiAnchorRef: React.RefObject<HTMLButtonElement>;
  emojiOpen: boolean;
  onToggleEmoji: () => void;
  onInsertImage: () => void;
  uploading: boolean;
  showShortcuts?: boolean;
}) {
  const btnStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "center",
    width: 30, height: 26, border: "1px solid transparent",
    borderRadius: "var(--radius-sm)", background: "transparent",
    color: "var(--text-2)", cursor: "pointer", transition: "all 0.12s", flexShrink: 0,
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "2px", width: "100%" }}>
      {TOOLBAR_BUTTONS.map(({ command, title, icon }, i) => (
        <div key={icon} style={{ display: "flex", alignItems: "center", gap: "2px" }}>
          {i === 3 && (
            <div style={{ width: 1, height: 18, background: "var(--border-light)", margin: "0 3px", flexShrink: 0 }} />
          )}
          <button
            type="button" title={title}
            onMouseDown={(e) => { e.preventDefault(); onCmd(command); }}
            style={btnStyle}
            onMouseEnter={(e) => { const b = e.currentTarget; b.style.background = "var(--bg-card)"; b.style.borderColor = "var(--border-light)"; b.style.color = "var(--emerald)"; }}
            onMouseLeave={(e) => { const b = e.currentTarget; b.style.background = "transparent"; b.style.borderColor = "transparent"; b.style.color = "var(--text-2)"; }}
          >
            <Icon type={icon} />
          </button>
        </div>
      ))}

      <div style={{ width: 1, height: 18, background: "var(--border-light)", margin: "0 3px", flexShrink: 0 }} />

      {/* Botão inserir imagem — spinner durante upload */}
      <button
        type="button"
        title={uploading ? "Enviando imagem…" : "Inserir imagem"}
        onMouseDown={(e) => { e.preventDefault(); if (!uploading) onInsertImage(); }}
        disabled={uploading}
        style={{ ...btnStyle, opacity: uploading ? 0.5 : 1, cursor: uploading ? "not-allowed" : "pointer" }}
        onMouseEnter={(e) => { if (!uploading) { const b = e.currentTarget; b.style.background = "var(--bg-card)"; b.style.borderColor = "var(--border-light)"; b.style.color = "var(--emerald)"; } }}
        onMouseLeave={(e) => { const b = e.currentTarget; b.style.background = "transparent"; b.style.borderColor = "transparent"; b.style.color = "var(--text-2)"; }}
      >
        {uploading
          ? <span style={{ width: 13, height: 13, borderRadius: "50%", border: "2px solid var(--border-light)", borderTopColor: "var(--emerald)", display: "inline-block", animation: "rte-spin 0.7s linear infinite" }} />
          : <Icon type="image" />
        }
      </button>

      <div style={{ width: 1, height: 18, background: "var(--border-light)", margin: "0 3px", flexShrink: 0 }} />

      <button
        ref={emojiAnchorRef} type="button" title="Inserir emoji"
        onMouseDown={(e) => { e.preventDefault(); onToggleEmoji(); }}
        style={{
          ...btnStyle, width: 30, fontSize: "0.95rem", lineHeight: 1,
          borderColor: emojiOpen ? "var(--border-light)" : "transparent",
          background: emojiOpen ? "var(--bg-card)" : "transparent",
          color: emojiOpen ? "var(--emerald)" : "var(--text-2)",
        }}
        onMouseEnter={(e) => { if (!emojiOpen) { const b = e.currentTarget; b.style.background = "var(--bg-card)"; b.style.borderColor = "var(--border-light)"; } }}
        onMouseLeave={(e) => { if (!emojiOpen) { const b = e.currentTarget; b.style.background = "transparent"; b.style.borderColor = "transparent"; } }}
      >
        😊
      </button>

      {showShortcuts && (
        <span style={{ marginLeft: "auto", fontSize: "0.65rem", color: "var(--text-3)", userSelect: "none", whiteSpace: "nowrap" }}>
          Ctrl+B · I · U
        </span>
      )}
    </div>
  );
}

/* ─── Componente principal ──────────────────────────── */

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Escreva aqui…",
  minHeight = "14rem",
}: RichTextEditorProps) {
  const editorRef      = useRef<HTMLDivElement>(null);
  const wrapperRef     = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);
  const lastHtmlRef    = useRef(value);
  const savedRangeRef  = useRef<Range | null>(null);
  const imageInputRef  = useRef<HTMLInputElement>(null);

  const [floatStyle, setFloatStyle] = useState<React.CSSProperties>({ position: "fixed", display: "none" });
  const [isFocused, setIsFocused]   = useState(false);
  const [uploading, setUploading]   = useState(false);

  const [emojiOpen, setEmojiOpen]         = useState(false);
  const emojiAnchorFixedRef               = useRef<HTMLButtonElement>(null!);
  const emojiAnchorFloatRef               = useRef<HTMLButtonElement>(null!);
  const activeEmojiAnchorRef              = useRef<React.RefObject<HTMLButtonElement>>(emojiAnchorFixedRef);

  /* Sincroniza valor externo → DOM */
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (el.innerHTML !== value) {
      el.innerHTML = value;
      lastHtmlRef.current = value;
    }
  }, [value]);

  const saveRange = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  }, []);

  const restoreRange = useCallback(() => {
    const range = savedRangeRef.current;
    if (!range) return;
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(range);
  }, []);

  const emitClean = useCallback(() => {
    const raw  = editorRef.current?.innerHTML ?? "";
    const html = sanitizeHtml(raw);
    if (html !== lastHtmlRef.current) {
      lastHtmlRef.current = html;
      onChange(html);
    }
  }, [onChange]);

  const execCmd = useCallback((command: string) => {
    restoreRange();
    editorRef.current?.focus();
    document.execCommand(command, false);
    emitClean();
  }, [restoreRange, emitClean]);

  const insertEmoji = useCallback((emoji: string) => {
    restoreRange();
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(emoji);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      document.execCommand("insertText", false, emoji);
    }
    emitClean();
    setEmojiOpen(false);
  }, [restoreRange, emitClean]);

  /* ── Insere <img> com URL do Storage no cursor ── */
  const insertImageUrl = useCallback((url: string, altText = "imagem") => {
    restoreRange();
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const img = document.createElement("img");
      img.src = url;
      img.alt = altText;
      img.style.maxWidth = "100%";
      img.style.height = "auto";
      img.style.display = "block";
      img.style.margin = "4px 0";
      img.style.borderRadius = "4px";
      range.insertNode(img);
      const after = document.createTextNode("\u00A0");
      img.after(after);
      range.setStartAfter(after);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    emitClean();
  }, [restoreRange, emitClean]);

  /* ── File → upload Storage → insere URL ── */
  const processImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("A imagem deve ter no máximo 10 MB.");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadImageToStorage(file);
      insertImageUrl(url, file.name);
    } catch (err) {
      console.error("Erro ao enviar imagem:", err);
      alert("Não foi possível enviar a imagem. Tente novamente.");
    } finally {
      setUploading(false);
    }
  }, [insertImageUrl]);

  /* ── Botão de upload ── */
  const handleInsertImage = useCallback(() => {
    saveRange();
    imageInputRef.current?.click();
  }, [saveRange]);

  const handleImageFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processImageFile(file);
    e.target.value = "";
  }, [processImageFile]);

  /* ── Colar imagem (Ctrl+V / mobile long-press paste) → upload → URL ── */
  const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find((item) => item.type.startsWith("image/"));
    if (!imageItem) return; // sem imagem → paste normal de texto/html
    e.preventDefault();
    const file = imageItem.getAsFile();
    if (file) await processImageFile(file);
  }, [processImageFile]);

  /* ── Toolbar flutuante ── */
  const updateFloat = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const rect     = wrapper.getBoundingClientRect();
    const toolbarH = 42;
    const needsFloat = rect.top < 64;
    if (!needsFloat) {
      setFloatStyle((prev) => (prev as any).display === "none" ? prev : { position: "fixed", display: "none" });
      return;
    }
    setFloatStyle({
      position: "fixed",
      top: Math.max(8, Math.min(rect.top + 44, rect.bottom - toolbarH - 4)),
      left: rect.left,
      width: rect.width,
      display: "flex",
      zIndex: 500,
    });
  }, []);

  useEffect(() => {
    if (!isFocused) { setFloatStyle({ position: "fixed", display: "none" }); return; }
    updateFloat();
    window.addEventListener("scroll", updateFloat, { passive: true });
    window.addEventListener("resize", updateFloat, { passive: true });
    return () => {
      window.removeEventListener("scroll", updateFloat);
      window.removeEventListener("resize", updateFloat);
    };
  }, [isFocused, updateFloat]);

  const handleInput    = useCallback(() => { if (!isComposingRef.current) emitClean(); }, [emitClean]);
  const handleKeyUp    = useCallback(() => { emitClean(); }, [emitClean]);

  const handleToggleEmoji = useCallback((anchor: React.RefObject<HTMLButtonElement>) => {
    activeEmojiAnchorRef.current = anchor;
    saveRange();
    setEmojiOpen((v) => !v);
  }, [saveRange]);

  const floatVisible = (floatStyle as any).display !== "none";

  const wrapperStyle: React.CSSProperties = {
    borderWidth: "1px", borderStyle: "solid",
    borderColor: isFocused ? "var(--emerald)" : "var(--border-light)",
    borderRadius: "var(--radius-sm)", overflow: "hidden",
    background: "var(--bg)", transition: "border-color 0.15s, box-shadow 0.15s",
    boxShadow: isFocused ? "0 0 0 2px var(--emerald-glow)" : "none",
  };

  return (
    <div style={{ position: "relative" }}>

      {/* Input oculto para seleção de arquivo */}
      <input
        ref={imageInputRef} type="file" accept="image/*"
        style={{ display: "none" }} onChange={handleImageFileChange}
      />

      {/* Overlay durante upload */}
      {uploading && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 10,
          background: "rgba(10,15,10,0.55)", borderRadius: "var(--radius-sm)",
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: "0.5rem", fontSize: "0.82rem", color: "var(--emerald)",
          fontWeight: 600, backdropFilter: "blur(2px)", pointerEvents: "all",
        }}>
          <span style={{
            width: 18, height: 18, borderRadius: "50%",
            border: "2px solid var(--emerald-dim)", borderTopColor: "var(--emerald)",
            display: "inline-block", animation: "rte-spin 0.7s linear infinite",
          }} />
          Enviando imagem…
        </div>
      )}

      {/* Toolbar flutuante */}
      {floatVisible && isFocused && (
        <div style={{
          ...floatStyle, alignItems: "center", gap: "2px",
          padding: "6px 10px", background: "var(--bg-elevated)",
          border: "1px solid var(--border-light)", borderRadius: "var(--radius-lg)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.35)", backdropFilter: "blur(8px)",
        }}>
          <ToolbarContent
            onCmd={execCmd}
            emojiAnchorRef={emojiAnchorFloatRef}
            emojiOpen={emojiOpen && activeEmojiAnchorRef.current === emojiAnchorFloatRef}
            onToggleEmoji={() => handleToggleEmoji(emojiAnchorFloatRef)}
            onInsertImage={handleInsertImage}
            uploading={uploading}
          />
        </div>
      )}

      {/* Wrapper principal */}
      <div ref={wrapperRef} style={wrapperStyle}>

        {/* Toolbar fixa */}
        <div style={{
          display: "flex", alignItems: "center", gap: "2px",
          padding: "6px 8px", borderBottom: "1px solid var(--border-light)",
          background: "var(--bg-elevated)",
        }}>
          <ToolbarContent
            onCmd={execCmd}
            emojiAnchorRef={emojiAnchorFixedRef}
            emojiOpen={emojiOpen && activeEmojiAnchorRef.current === emojiAnchorFixedRef}
            onToggleEmoji={() => handleToggleEmoji(emojiAnchorFixedRef)}
            onInsertImage={handleInsertImage}
            uploading={uploading}
            showShortcuts
          />
        </div>

        {/* Área de edição */}
        <div
          ref={editorRef}
          className="rte-editor-area"
          contentEditable
          suppressContentEditableWarning
          onFocus={() => setIsFocused(true)}
          onBlur={(e) => {
            const related = e.relatedTarget as Node | null;
            if (wrapperRef.current?.contains(related)) return;
            saveRange();
            setIsFocused(false);
          }}
          onMouseUp={saveRange}
          onKeyUp={() => { saveRange(); handleKeyUp(); }}
          onInput={handleInput}
          onPaste={handlePaste}
          onCompositionStart={() => { isComposingRef.current = true; }}
          onCompositionEnd={() => { isComposingRef.current = false; emitClean(); }}
          data-placeholder={placeholder}
          style={{
            minHeight, padding: "0.875rem 1rem", outline: "none",
            fontSize: "0.9rem", lineHeight: 1.75, color: "var(--text-1)",
            caretColor: "var(--emerald)", wordBreak: "break-word",
            overflowWrap: "break-word",
          }}
        />
      </div>

      {/* Emoji Picker */}
      {emojiOpen && (
        <EmojiPicker
          onSelect={insertEmoji}
          onClose={() => setEmojiOpen(false)}
          anchorRef={activeEmojiAnchorRef.current}
        />
      )}

      <style>{`
        .rte-editor-area[contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: var(--text-3);
          pointer-events: none;
        }

        /* FIX mobile: white-space só no container, não nos filhos */
        .rte-editor-area[contenteditable] {
          white-space: pre-wrap;
        }
        .rte-editor-area[contenteditable] * {
          color: inherit !important;
          background-color: transparent !important;
          font-size: inherit !important;
          font-family: inherit !important;
        }
        .rte-editor-area[contenteditable] img {
          white-space: normal !important;
          max-width: 100%;
          height: auto;
          cursor: default;
          display: block;
          margin: 4px 0;
          border-radius: 4px;
        }
        .rte-editor-area[contenteditable] b,
        .rte-editor-area[contenteditable] strong { font-weight: 700; }
        .rte-editor-area[contenteditable] i,
        .rte-editor-area[contenteditable] em     { font-style: italic; }
        .rte-editor-area[contenteditable] u      { text-decoration: underline; }

        @keyframes rte-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}