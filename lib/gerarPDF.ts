import jsPDF from "jspdf";
import type { LinkReferencia } from "@/components/LinksReferencia";

async function carregarFonteUnicode(pdf: jsPDF): Promise<void> {
  try {
    const response = await fetch("/fonts/NotoSerif-Regular.ttf");
    const buffer = await response.arrayBuffer();
    const uint8 = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < uint8.length; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    const base64 = btoa(binary);
    pdf.addFileToVFS("NotoSerif-Regular.ttf", base64);
    pdf.addFont("NotoSerif-Regular.ttf", "NotoSerif", "normal");
    pdf.addFileToVFS("NotoSerif-Bold.ttf", base64);
    pdf.addFont("NotoSerif-Regular.ttf", "NotoSerif", "bold");
  } catch (err) {
    console.warn("Fonte unicode não carregada, usando fallback:", err);
  }
}

function normalizeUrl(url: string): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return "https://" + url;
}

const TIPO_LABEL: Record<LinkReferencia["tipo"], string> = {
  youtube: "▶  YouTube",
  blog:    "✍  Blog / Site",
  livro:   "📖  Livro",
  site:    "🌐  Site",
  outro:   "🔗  Link",
};

export async function gerarPDF({
  titulo, nomeAutor, fotoAutor, dataPost, igreja, conteudo, tipo, postId, links,
  onDownload,
}: {
  titulo: string;
  nomeAutor: string;
  fotoAutor: string | null;
  dataPost: string;
  igreja: string;
  conteudo: string;
  tipo: string;
  postId?: string;
  links?: LinkReferencia[];
  onDownload?: () => void;
}) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const largura = pdf.internal.pageSize.getWidth();
  const alturaUtil = pdf.internal.pageSize.getHeight() - 20;
  const margem = 20;
  const larguraUtil = largura - margem * 2;
  let y = 20;

  await carregarFonteUnicode(pdf);
  const fonteCorpo = "NotoSerif";
  const fonteMeta  = "NotoSerif";

  /* ── Cabeçalho do autor ── */
  if (fotoAutor) {
    try {
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.crossOrigin = "anonymous";
        i.onload = () => res(i);
        i.onerror = () => rej();
        i.src = fotoAutor;
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      pdf.addImage(canvas.toDataURL("image/jpeg"), "JPEG", margem, y, 14, 14);
      pdf.setFont(fonteMeta, "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(30, 30, 30);
      pdf.text(nomeAutor, margem + 18, y + 5);
      if (dataPost || igreja) {
        pdf.setFont(fonteMeta, "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(100, 100, 100);
        pdf.text([igreja, dataPost].filter(Boolean).join(" · "), margem + 18, y + 11);
      }
      y += 22;
    } catch {
      pdf.setFont(fonteMeta, "bold"); pdf.setFontSize(11); pdf.setTextColor(30, 30, 30);
      pdf.text(nomeAutor, margem, y + 5); y += 14;
    }
  } else {
    pdf.setFont(fonteMeta, "bold"); pdf.setFontSize(11); pdf.setTextColor(30, 30, 30);
    pdf.text(nomeAutor, margem, y + 5);
    if (dataPost || igreja) {
      pdf.setFont(fonteMeta, "normal"); pdf.setFontSize(9); pdf.setTextColor(100, 100, 100);
      pdf.text([igreja, dataPost].filter(Boolean).join(" · "), margem, y + 12);
    }
    y += 18;
  }

  /* ── Linha divisória ── */
  pdf.setDrawColor(200, 200, 200);
  pdf.line(margem, y, largura - margem, y);
  y += 8;

  /* ── Título ── */
  pdf.setFont(fonteMeta, "bold"); pdf.setFontSize(20); pdf.setTextColor(15, 15, 15);
  const linhasTitulo = pdf.splitTextToSize(titulo, larguraUtil);
  pdf.text(linhasTitulo, margem, y);
  y += linhasTitulo.length * 8 + 6;

  /* ── Linha divisória ── */
  pdf.setDrawColor(220, 220, 220);
  pdf.line(margem, y, largura - margem, y);
  y += 8;

  /* ── Conteúdo ── */
  pdf.setFont(fonteCorpo, "normal"); pdf.setFontSize(11); pdf.setTextColor(40, 40, 40);
  const linhasConteudo = pdf.splitTextToSize(conteudo, larguraUtil);
  for (const linha of linhasConteudo) {
    if (y + 6 > alturaUtil) { pdf.addPage(); y = margem; }
    pdf.text(linha, margem, y);
    y += 6;
  }

  /* ── Rodapé do conteúdo ── */
  y += 8;
  if (y + 10 > alturaUtil) { pdf.addPage(); y = margem; }
  pdf.setFont(fonteMeta, "normal"); pdf.setFontSize(9); pdf.setTextColor(130, 130, 130);
  const rodape = tipo === "sermao"
    ? (igreja ? `Sermão pregado na ${igreja}${dataPost ? ` em ${dataPost}` : ""}` : dataPost ? `Sermão pregado em ${dataPost}` : "")
    : `Artigo publicado por ${nomeAutor}${dataPost ? ` em ${dataPost}` : ""}`;
  if (rodape) pdf.text(rodape, margem, y);

  /* ── Links de referência (clicáveis no PDF) ── */
  const linksFiltrados = (links ?? []).filter((l) => l.label?.trim() && l.url?.trim());
  if (linksFiltrados.length > 0) {
    y += 12;
    if (y + 10 > alturaUtil) { pdf.addPage(); y = margem; }

    // Título da seção
    pdf.setFont(fonteMeta, "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.text("REFERÊNCIAS & LINKS", margem, y);
    y += 6;

    pdf.setDrawColor(220, 220, 220);
    pdf.line(margem, y, largura - margem, y);
    y += 5;

    for (const link of linksFiltrados) {
      if (y + 16 > alturaUtil) { pdf.addPage(); y = margem; }

      const url = normalizeUrl(link.url);
      const tipoLabel = TIPO_LABEL[link.tipo] ?? "🔗  Link";

      // Caixa de fundo
      pdf.setFillColor(245, 250, 247);
      pdf.setDrawColor(200, 230, 215);
      pdf.roundedRect(margem, y, larguraUtil, 13, 2, 2, "FD");

      // Ícone/tipo (pequeno, cinza)
      pdf.setFont(fonteMeta, "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(120, 150, 130);
      pdf.text(tipoLabel, margem + 3, y + 5);

      // Label do link (negrito, verde escuro)
      pdf.setFont(fonteMeta, "bold");
      pdf.setFontSize(9.5);
      pdf.setTextColor(5, 90, 60);
      const labelTruncado = pdf.splitTextToSize(link.label, larguraUtil - 6)[0];
      pdf.text(labelTruncado, margem + 3, y + 10);

      // URL clicável (azul sublinhado)
      pdf.setFont(fonteMeta, "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(30, 100, 200);
      const urlTruncada = url.length > 80 ? url.slice(0, 77) + "..." : url;
      pdf.textWithLink(urlTruncada, margem + larguraUtil - pdf.getTextWidth(urlTruncada) - 3, y + 10, { url });

      y += 17;
    }
  }

  /* ── Salvar ── */
  const slugify = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

  pdf.save(`${slugify(titulo)}_${slugify(nomeAutor)}.pdf`);
  onDownload?.();
}