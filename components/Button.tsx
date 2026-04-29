"use client";

/**
 * FileImportButton
 * Lê .txt, .md, .rtf, .doc, .docx, .odt, .odf e injeta o texto
 * no campo de conteúdo do formulário de criação/edição de post.
 *
 * Uso:
 *   <FileImportButton onImport={(texto) =>
 *     setConteudo((prev) => prev.trim() ? prev + "\n\n" + texto : texto)
 *   } />
 */

import { useRef, useState } from "react";

function IconPaperclip({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M13.5 7.5L7.5 13.5a3.536 3.536 0 0 1-5-5l6.5-6.5a2.121 2.121 0 0 1 3 3L6 11a.707.707 0 0 1-1-1l5.5-5.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const ACCEPT = ".txt,.md,.rtf,.doc,.docx,.odt,.odf";

async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (
    name.endsWith(".docx") ||
    name.endsWith(".doc") ||
    name.endsWith(".odt") ||
    name.endsWith(".odf")
  ) {
    try {
      const mammoth = await import("mammoth");
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      if (result.value.trim()) return result.value;
    } catch (_) {
      // fallback para leitura de texto simples
    }
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) ?? "");
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsText(file, "utf-8");
  });
}

type Props = {
  onImport: (texto: string) => void;
};

export default function FileImportButton({ onImport }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setErro(null);
    setLoading(true);
    try {
      const texto = await extractText(file);
      if (!texto.trim()) {
        setErro("Arquivo vazio ou não pôde ser lido.");
        setLoading(false);
        return;
      }
      onImport(texto);
    } catch (err: any) {
      setErro(err?.message ?? "Erro ao importar.");
    }
    setLoading(false);
  }

  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 4,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={handleChange}
        style={{ display: "none" }}
        aria-label="Importar arquivo de texto"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="file-import-btn"
        title="Importar conteúdo de arquivo (.txt, .doc, .docx, .odt…)"
        style={{
          opacity: loading ? 0.65 : 1,
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          minHeight: 40,
          padding: "8px 14px",
          fontSize: "0.85rem",
          fontWeight: 600,
          cursor: loading ? "not-allowed" : "pointer",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-light)",
          borderRadius: "var(--radius-md)",
          color: "var(--text-2)",
          transition: "border-color 0.15s, background 0.15s",
        }}
        onMouseEnter={(e) => {
          if (!loading) {
            e.currentTarget.style.borderColor = "var(--emerald-dim)";
            e.currentTarget.style.background = "var(--bg-card)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--border-light)";
          e.currentTarget.style.background = "var(--bg-elevated)";
        }}
      >
        {loading ? (
          <>
            <span className="btn-spinner" />
            Lendo…
          </>
        ) : (
          <>
            <IconPaperclip size={14} />
            Importar arquivo
          </>
        )}
      </button>
      {erro && (
        <span
          style={{ fontSize: "0.72rem", color: "#f87171", paddingLeft: 2 }}
        >
          {erro}
        </span>
      )}
    </div>
  );
}
