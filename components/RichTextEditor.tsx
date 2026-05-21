"use client";

import { useRef, useEffect, useCallback } from "react";

/* ─── Tipos ─────────────────────────────────────────── */

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

/* ─── Sanitizador de HTML ────────────────────────────
   Remove atributos indesejados (style, class, color…)
   mas preserva apenas: text-align em divs/p, e as tags
   semânticas b/strong/i/em/u/br/div/p/span.
   Roda só no browser (usa DOMParser).
──────────────────────────────────────────────────── */

const ALLOWED_TAGS = new Set([
  "b","strong","i","em","u","br","div","p","span",
]);

function sanitizeHtml(raw: string): string {
  if (typeof window === "undefined") return raw;

  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, "text/html");

  function clean(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) return;
    if (node.nodeType !== Node.ELEMENT_NODE) {
      node.parentNode?.removeChild(node);
      return;
    }

    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    /* Remove tags não permitidas mas mantém filhos */
    if (!ALLOWED_TAGS.has(tag)) {
      const frag = document.createDocumentFragment();
      while (el.firstChild) frag.appendChild(el.firstChild);
      el.parentNode?.replaceChild(frag, el);
      frag.childNodes.forEach(clean);
      return;
    }

    /* Remove todos os atributos exceto text-align em divs/p */
    const attrs = Array.from(el.attributes);
    for (const attr of attrs) {
      if (attr.name === "style") {
        /* Mantém apenas text-align */
        const alignMatch = attr.value.match(/text-align\s*:\s*(left|center|right|justify)/i);
        if (alignMatch) {
          el.setAttribute("style", `text-align: ${alignMatch[1]}`);
        } else {
          el.removeAttribute("style");
        }
      } else {
        el.removeAttribute(attr.name);
      }
    }

    el.childNodes.forEach(clean);
  }

  doc.body.childNodes.forEach(clean);
  return doc.body.innerHTML;
}

/* ─── Botões da toolbar ─────────────────────────────── */

type ToolbarAction =
  | { command: "bold" }
  | { command: "italic" }
  | { command: "underline" }
  | { command: "justifyLeft" }
  | { command: "justifyCenter" }
  | { command: "justifyFull" };

const TOOLBAR_BUTTONS: {
  action: ToolbarAction;
  title: string;
  icon: string;
}[] = [
  { action: { command: "bold" },          title: "Negrito (Ctrl+B)",    icon: "bold" },
  { action: { command: "italic" },        title: "Itálico (Ctrl+I)",    icon: "italic" },
  { action: { command: "underline" },     title: "Sublinhado (Ctrl+U)", icon: "underline" },
  { action: { command: "justifyLeft" },   title: "Alinhar à esquerda",  icon: "left" },
  { action: { command: "justifyCenter" }, title: "Centralizar",          icon: "center" },
  { action: { command: "justifyFull" },   title: "Justificar",           icon: "justify" },
];

/* ─── Ícones SVG inline ─────────────────────────────── */

function Icon({ type }: { type: string }) {
  const s: React.CSSProperties = {
    width: 16,
    height: 16,
    display: "block",
    stroke: "currentColor",
    fill: "none",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  if (type === "bold") return (
    <svg viewBox="0 0 24 24" style={s}>
      <path d="M6 4h8a4 4 0 010 8H6z"/>
      <path d="M6 12h9a4 4 0 010 8H6z"/>
    </svg>
  );
  if (type === "italic") return (
    <svg viewBox="0 0 24 24" style={s}>
      <line x1="19" y1="4" x2="10" y2="4"/>
      <line x1="14" y1="20" x2="5" y2="20"/>
      <line x1="15" y1="4" x2="9" y2="20"/>
    </svg>
  );
  if (type === "underline") return (
    <svg viewBox="0 0 24 24" style={s}>
      <path d="M6 3v7a6 6 0 0012 0V3"/>
      <line x1="4" y1="21" x2="20" y2="21"/>
    </svg>
  );
  if (type === "left") return (
    <svg viewBox="0 0 24 24" style={s}>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="12" x2="15" y2="12"/>
      <line x1="3" y1="18" x2="18" y2="18"/>
    </svg>
  );
  if (type === "center") return (
    <svg viewBox="0 0 24 24" style={s}>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="6" y1="12" x2="18" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  );
  if (type === "justify") return (
    <svg viewBox="0 0 24 24" style={s}>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  );
  return null;
}

/* ─── Componente principal ──────────────────────────── */

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Escreva aqui…",
  minHeight = "14rem",
}: RichTextEditorProps) {
  const editorRef     = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);
  const lastHtmlRef   = useRef(value);

  /* Sincroniza valor externo → DOM apenas quando muda por fora */
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (el.innerHTML !== value) {
      el.innerHTML = value;
      lastHtmlRef.current = value;
    }
  }, [value]);

  /* Coleta HTML, sanitiza e notifica pai */
  const emitClean = useCallback(() => {
    const raw  = editorRef.current?.innerHTML ?? "";
    const html = sanitizeHtml(raw);
    if (html !== lastHtmlRef.current) {
      lastHtmlRef.current = html;
      onChange(html);
    }
  }, [onChange]);

  /* Executa um comando de formatação e devolve foco ao editor */
  const execCmd = useCallback((command: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false);
    emitClean();
  }, [emitClean]);

  const handleInput = useCallback(() => {
    if (isComposingRef.current) return;
    emitClean();
  }, [emitClean]);

  const handleKeyUp = useCallback(() => {
    emitClean();
  }, [emitClean]);

  return (
    <div
      style={{
        border: "1px solid var(--border-light)",
        borderRadius: "var(--radius-sm)",
        overflow: "hidden",
        background: "var(--bg)",
        transition: "border-color 0.15s",
      }}
      onFocusCapture={(e) => {
        const wrapper = e.currentTarget as HTMLDivElement;
        wrapper.style.borderColor = "var(--emerald)";
        wrapper.style.boxShadow = "0 0 0 2px var(--emerald-glow)";
      }}
      onBlurCapture={(e) => {
        const wrapper = e.currentTarget as HTMLDivElement;
        wrapper.style.borderColor = "var(--border-light)";
        wrapper.style.boxShadow = "none";
      }}
    >
      {/* ── Toolbar ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "2px",
          padding: "6px 8px",
          borderBottom: "1px solid var(--border-light)",
          background: "var(--bg-elevated)",
        }}
      >
        {TOOLBAR_BUTTONS.map(({ action, title, icon }, i) => {
          const isDivider = i === 3; // separador entre formatação e alinhamento
          return (
            <div
              key={icon}
              style={{ display: "flex", alignItems: "center", gap: "2px" }}
            >
              {isDivider && (
                <div
                  style={{
                    width: 1,
                    height: 20,
                    background: "var(--border-light)",
                    margin: "0 4px",
                    flexShrink: 0,
                  }}
                />
              )}
              <button
                type="button"
                title={title}
                onMouseDown={(e) => {
                  e.preventDefault(); // impede perda de seleção
                  execCmd(action.command);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32,
                  height: 28,
                  border: "1px solid transparent",
                  borderRadius: "var(--radius-sm)",
                  background: "transparent",
                  color: "var(--text-2)",
                  cursor: "pointer",
                  transition: "all 0.12s",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  const btn = e.currentTarget;
                  btn.style.background = "var(--bg-card)";
                  btn.style.borderColor = "var(--border-light)";
                  btn.style.color = "var(--emerald)";
                }}
                onMouseLeave={(e) => {
                  const btn = e.currentTarget;
                  btn.style.background = "transparent";
                  btn.style.borderColor = "transparent";
                  btn.style.color = "var(--text-2)";
                }}
              >
                <Icon type={icon} />
              </button>
            </div>
          );
        })}

        {/* Dica de atalhos */}
        <span
          style={{
            marginLeft: "auto",
            fontSize: "0.68rem",
            color: "var(--text-3)",
            userSelect: "none",
          }}
        >
          Ctrl+B · Ctrl+I · Ctrl+U
        </span>
      </div>

      {/* ── Área de edição ── */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyUp={handleKeyUp}
        onCompositionStart={() => { isComposingRef.current = true; }}
        onCompositionEnd={() => {
          isComposingRef.current = false;
          emitClean();
        }}
        data-placeholder={placeholder}
        style={{
          minHeight,
          padding: "0.875rem 1rem",
          outline: "none",
          fontSize: "0.9rem",
          lineHeight: 1.75,
          color: "var(--text-1)",
          caretColor: "var(--emerald)",
          wordBreak: "break-word",
          overflowWrap: "break-word",
        }}
      />

      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: var(--text-3);
          pointer-events: none;
        }
        /* Garante que estilos inline injetados pelo browser não afetam cor/fonte */
        [contenteditable] * {
          color: inherit !important;
          background-color: transparent !important;
          font-size: inherit !important;
          font-family: inherit !important;
          white-space: pre-wrap !important;
        }
        [contenteditable] b,
        [contenteditable] strong { font-weight: 700; }
        [contenteditable] i,
        [contenteditable] em    { font-style: italic; }
        [contenteditable] u     { text-decoration: underline; }
      `}</style>
    </div>
  );
}