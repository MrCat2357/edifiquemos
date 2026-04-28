import jsPDF from "jspdf";

export async function gerarPDF({
  titulo, nomeAutor, fotoAutor, dataPost, igreja, conteudo, tipo, postId,
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
  onDownload?: () => void; // callback após salvar (para incrementar contador)
}) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const largura = pdf.internal.pageSize.getWidth();
  const margem = 20;
  const larguraUtil = largura - margem * 2;
  let y = 20;

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
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(30, 30, 30);
      pdf.text(nomeAutor, margem + 18, y + 5);
      if (dataPost || igreja) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(100, 100, 100);
        pdf.text([igreja, dataPost].filter(Boolean).join(" · "), margem + 18, y + 11);
      }
      y += 22;
    } catch {
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); pdf.setTextColor(30, 30, 30);
      pdf.text(nomeAutor, margem, y + 5); y += 14;
    }
  } else {
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); pdf.setTextColor(30, 30, 30);
    pdf.text(nomeAutor, margem, y + 5);
    if (dataPost || igreja) {
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(100, 100, 100);
      pdf.text([igreja, dataPost].filter(Boolean).join(" · "), margem, y + 12);
    }
    y += 18;
  }

  pdf.setDrawColor(200, 200, 200);
  pdf.line(margem, y, largura - margem, y);
  y += 8;

  pdf.setFont("helvetica", "bold"); pdf.setFontSize(20); pdf.setTextColor(15, 15, 15);
  const linhasTitulo = pdf.splitTextToSize(titulo, larguraUtil);
  pdf.text(linhasTitulo, margem, y);
  y += linhasTitulo.length * 8 + 6;

  pdf.setDrawColor(220, 220, 220);
  pdf.line(margem, y, largura - margem, y);
  y += 8;

  pdf.setFont("times", "normal"); pdf.setFontSize(11); pdf.setTextColor(40, 40, 40);
  const alturaUtil = pdf.internal.pageSize.getHeight() - margem * 2;
  const linhasConteudo = pdf.splitTextToSize(conteudo, larguraUtil);
  for (const linha of linhasConteudo) {
    if (y + 6 > alturaUtil) { pdf.addPage(); y = margem; }
    pdf.text(linha, margem, y);
    y += 6;
  }

  y += 8;
  if (y + 10 > alturaUtil) { pdf.addPage(); y = margem; }
  pdf.setFont("helvetica", "italic"); pdf.setFontSize(9); pdf.setTextColor(130, 130, 130);
  const rodape = tipo === "sermao"
    ? (igreja ? `Sermão pregado na ${igreja}${dataPost ? ` em ${dataPost}` : ""}` : dataPost ? `Sermão pregado em ${dataPost}` : "")
    : `Artigo publicado por ${nomeAutor}${dataPost ? ` em ${dataPost}` : ""}`;
  if (rodape) pdf.text(rodape, margem, y);

  const slugify = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

  pdf.save(`${slugify(titulo)}_${slugify(nomeAutor)}.pdf`);

  // Chama callback depois de salvar (incrementa downloads no Firestore)
  onDownload?.();
}