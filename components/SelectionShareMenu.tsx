"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  postTitulo: string;
  postUrl: string;
};

export default function SelectionShareMenu({ postTitulo, postUrl }: Props) {
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    texto: string;
  } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleMouseUp(e: MouseEvent) {
      // Ignora clique dentro do próprio menu
      if (menuRef.current?.contains(e.target as Node)) return;

      setTimeout(() => {
        const sel = window.getSelection();
        const texto = sel?.toString().trim() ?? "";

        if (!texto || texto.length < 5) {
          setMenu(null);
          return;
        }

        const range = sel!.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        const menuWidth = 220;
        const menuHeight = 160;
        const margin = 8;

        let x = rect.left + rect.width / 2 - menuWidth / 2;
        let y = rect.top - menuHeight - margin + window.scrollY;

        // Se sair pela esquerda
        if (x < margin) x = margin;
        // Se sair pela direita
        if (x + menuWidth > window.innerWidth - margin)
          x = window.innerWidth - menuWidth - margin;
        // Se sair pelo topo, aparece embaixo
        if (y - window.scrollY < margin)
          y = rect.bottom + margin + window.scrollY;

        setMenu({ x, y, texto });
        setCopiado(false);
      }, 10);
    }

    function handleMouseDown(e: MouseEvent) {
      if (menuRef.current?.contains(e.target as Node)) return;
      setMenu(null);
    }

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, []);

  function buildTexto() {
    return `"${menu!.texto}"\n\n— ${postTitulo}\n${postUrl}`;
  }

  function handleWhatsApp() {
    const encoded = encodeURIComponent(buildTexto());
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
    setMenu(null);
  }

  async function handleCopiar() {
    try {
      await navigator.clipboard.writeText(buildTexto());
      setCopiado(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setCopiado(false);
        setMenu(null);
      }, 1800);
    } catch {
      setMenu(null);
    }
  }

  if (!menu) return null;

  return (
    <div
      ref={menuRef}
      className="selection-share-menu"
      style={{ left: menu.x, top: menu.y }}
    >
      <div className="selection-share-menu-title">Compartilhar trecho</div>
      <div className="selection-share-menu-quote">"{menu.texto}"</div>

      <button className="selection-share-btn" onClick={handleWhatsApp}>
        <span className="selection-share-btn-icon whatsapp">W</span>
        Enviar no WhatsApp
      </button>

      <button className="selection-share-btn" onClick={handleCopiar}>
        <span className="selection-share-btn-icon copy">
          {copiado ? "✓" : "⎘"}
        </span>
        {copiado ? "Copiado!" : "Copiar trecho"}
      </button>
    </div>
  );
}