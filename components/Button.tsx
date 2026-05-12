"use client";

/**
 * FileImportButton
 * Lê .txt, .md, .rtf, .doc, .docx, .odt, .odf, .pdf e injeta o texto
 * no campo de conteúdo do formulário de criação/edição de post.
 *
 * Uso:
 *   <FileImportButton onImport={(texto) =>
 *     setConteudo((prev) => prev.trim() ? prev + "\n\n" + texto : texto)
 *   } />
 */

import { useRef, useState } from "react";
import { importarArquivo, FORMATOS_ACEITOS } from "@/lib/importarArquivo";

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

type Props = {
  onImport: (texto: string) => void;
};

export default function FileImportButton({ onImport }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setErro(null);
    setLoading(true);

    try {
      const texto = await importarArquivo(file);
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
        accept={FORMATOS_ACEITOS}
        onChange={handleChange}
        style={{ display: "none" }}
        aria-label="Importar arquivo de texto"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        title="Importar conteúdo de arquivo (.txt, .md, .doc, .docx, .pdf, .odt, .rtf…)"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          opacity: loading ? 0.7 : 1,
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          minHeight: 36,
          padding: "7px 14px",
          fontSize: "0.82rem",
          fontWeight: 600,
          cursor: loading ? "not-allowed" : "pointer",
          fontFamily: "inherit",
          borderRadius: "var(--radius-full)",
          transition: "all 0.18s ease",

          // Borda esmeralda visível + fundo levemente tingido de verde
          border: hovered
            ? "1px solid var(--emerald)"
            : "1px solid var(--emerald-dim)",
          background: hovered
            ? "var(--emerald-dim)"
            : "rgba(6, 78, 53, 0.22)",
          color: hovered ? "var(--emerald)" : "var(--text-2)",

          // Sombra esmeralda leve que o levanta do fundo escuro
          boxShadow: hovered
            ? "0 0 0 3px var(--emerald-dim), 0 2px 8px rgba(16,185,129,0.15)"
            : "0 1px 4px rgba(0,0,0,0.3)",
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
        <span style={{ fontSize: "0.72rem", color: "#f87171", paddingLeft: 2 }}>
          {erro}
        </span>
      )}
    </div>
  );
}