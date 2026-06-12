"use client";

/**
 * components/SlideCarrossel.tsx
 *
 * Carrossel horizontal de slides renderizados a partir de um PDF.
 * Funciona com File (antes de publicar) ou URL string (post publicado).
 *
 * Dependência: npm install react-pdf
 * (já inclui os tipos — não precisa de @types/react-pdf)
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Worker do PDF.js via CDN (sem configuração de webpack)
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface SlideCarrosselProps {
  /** File local (antes de publicar) ou URL pública (post publicado) */
  fonte: File | string;
  /** Altura de cada slide em px. Padrão: 400 */
  altura?: number;
  /** Callback chamado quando o total de páginas é conhecido */
  onPageCount?: (total: number) => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function SlideCarrossel({
  fonte,
  altura = 400,
  onPageCount,
}: SlideCarrosselProps) {
  const [numPages,    setNumPages]    = useState<number>(0);
  const [paginaAtual, setPaginaAtual] = useState<number>(1);
  const [largura,     setLargura]     = useState<number>(680);
  const [carregando,  setCarregando]  = useState<boolean>(true);
  const [erro,        setErro]        = useState<string | null>(null);
  const [tocando,     setTocando]     = useState<boolean>(false); // swipe

  const wrapRef   = useRef<HTMLDivElement>(null);
  const touchXRef = useRef<number | null>(null);

  // Medir largura do container para escalar o PDF corretamente
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setLargura(Math.floor(entry.contentRect.width));
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Montar fonte para o <Document>
  const file = fonte instanceof File
    ? fonte
    : { url: fonte };

  function onDocumentoCarregado({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setCarregando(false);
    setErro(null);
    onPageCount?.(numPages);
  }

  function onErro(err: Error) {
    console.error("[SlideCarrossel] Erro ao carregar PDF:", err);
    setErro("Não foi possível carregar o PDF. Verifique se o arquivo é válido.");
    setCarregando(false);
  }

  const irPara = useCallback((pagina: number) => {
    setPaginaAtual((p) => {
      const nova = Math.max(1, Math.min(numPages, pagina));
      return nova === p ? p : nova;
    });
  }, [numPages]);

  // Swipe touch
  function onTouchStart(e: React.TouchEvent) {
    touchXRef.current = e.touches[0].clientX;
    setTocando(true);
  }
  function onTouchEnd(e: React.TouchEvent) {
    setTocando(false);
    if (touchXRef.current === null) return;
    const delta = touchXRef.current - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 40) irPara(paginaAtual + (delta > 0 ? 1 : -1));
    touchXRef.current = null;
  }

  // Teclado (foco no container)
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") irPara(paginaAtual + 1);
    if (e.key === "ArrowLeft")  irPara(paginaAtual - 1);
  }

  const podePrev = paginaAtual > 1;
  const podeNext = paginaAtual < numPages;

  return (
    <div
      ref={wrapRef}
      onKeyDown={onKeyDown}
      tabIndex={0}
      style={{
        outline: "none",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        border: "1px solid var(--border)",
        background: "#0d1310",
        position: "relative",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {/* ── Área do slide ─────────────────────────────────────────── */}
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{
          minHeight: carregando ? `${altura}px` : undefined,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: tocando ? "grabbing" : "grab",
          transition: "opacity 0.15s",
        }}
      >
        {/* Estado de carregamento */}
        {carregando && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: "0.75rem",
            color: "var(--text-3)", fontSize: "0.82rem",
          }}>
            <span style={{
              display: "inline-block", width: 28, height: 28,
              border: "3px solid var(--border-light)",
              borderTopColor: "var(--emerald)",
              borderRadius: "50%", animation: "spin 0.7s linear infinite",
            }} />
            Carregando slides…
          </div>
        )}

        {/* Erro */}
        {erro && !carregando && (
          <div style={{
            padding: "2rem", textAlign: "center",
            color: "rgba(239,68,68,0.85)", fontSize: "0.82rem", lineHeight: 1.6,
          }}>
            ⚠️ {erro}
          </div>
        )}

        <Document
          file={file}
          onLoadSuccess={onDocumentoCarregado}
          onLoadError={onErro}
          loading={null}
          error={null}
        >
          {numPages > 0 && (
            <Page
              pageNumber={paginaAtual}
              width={largura}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              loading={null}
            />
          )}
        </Document>
      </div>

      {/* ── Controles de navegação ──────────────────────────────────── */}
      {numPages > 1 && !carregando && !erro && (
        <>
          {/* Botão anterior */}
          <button
            onClick={() => irPara(paginaAtual - 1)}
            disabled={!podePrev}
            aria-label="Slide anterior"
            style={{
              position: "absolute", left: "0.625rem", top: "50%",
              transform: "translateY(-50%)",
              background: podePrev ? "rgba(10,15,10,0.80)" : "rgba(10,15,10,0.35)",
              border: "1px solid var(--border-light)",
              color: podePrev ? "var(--text-1)" : "var(--text-3)",
              borderRadius: "var(--radius-full)",
              width: 36, height: 36,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: podePrev ? "pointer" : "default",
              fontSize: "1rem", transition: "all 0.15s",
              backdropFilter: "blur(6px)",
            }}
            onMouseEnter={(e) => { if (podePrev) e.currentTarget.style.background = "rgba(10,15,10,0.95)"; }}
            onMouseLeave={(e) => { if (podePrev) e.currentTarget.style.background = "rgba(10,15,10,0.80)"; }}
          >‹</button>

          {/* Botão próximo */}
          <button
            onClick={() => irPara(paginaAtual + 1)}
            disabled={!podeNext}
            aria-label="Próximo slide"
            style={{
              position: "absolute", right: "0.625rem", top: "50%",
              transform: "translateY(-50%)",
              background: podeNext ? "rgba(10,15,10,0.80)" : "rgba(10,15,10,0.35)",
              border: "1px solid var(--border-light)",
              color: podeNext ? "var(--text-1)" : "var(--text-3)",
              borderRadius: "var(--radius-full)",
              width: 36, height: 36,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: podeNext ? "pointer" : "default",
              fontSize: "1rem", transition: "all 0.15s",
              backdropFilter: "blur(6px)",
            }}
            onMouseEnter={(e) => { if (podeNext) e.currentTarget.style.background = "rgba(10,15,10,0.95)"; }}
            onMouseLeave={(e) => { if (podeNext) e.currentTarget.style.background = "rgba(10,15,10,0.80)"; }}
          >›</button>

          {/* Indicador de página */}
          <div style={{
            position: "absolute", bottom: "0.625rem", left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(10,15,10,0.75)",
            border: "1px solid var(--border-light)",
            borderRadius: "var(--radius-full)",
            padding: "3px 12px",
            fontSize: "0.72rem", fontWeight: 600,
            color: "var(--text-2)",
            backdropFilter: "blur(6px)",
            whiteSpace: "nowrap",
          }}>
            {paginaAtual} / {numPages}
          </div>

          {/* Pontos indicadores (até 10 páginas) */}
          {numPages <= 10 && (
            <div style={{
              position: "absolute", bottom: "0.625rem", right: "0.75rem",
              display: "flex", gap: "4px", alignItems: "center",
            }}>
              {Array.from({ length: numPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => irPara(i + 1)}
                  aria-label={`Ir para slide ${i + 1}`}
                  style={{
                    width: i + 1 === paginaAtual ? 16 : 6,
                    height: 6,
                    borderRadius: "var(--radius-full)",
                    background: i + 1 === paginaAtual ? "var(--emerald)" : "var(--border-light)",
                    border: "none", cursor: "pointer", padding: 0,
                    transition: "all 0.2s",
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}