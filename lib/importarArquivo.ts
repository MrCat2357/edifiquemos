/**
 * importarArquivo.ts
 * Extrai texto puro de: .txt  .md  .docx  .doc  .pdf  .odt  .odf  .rtf
 * Roda 100% no browser — sem backend.
 *
 * Dependências:
 *   npm install pdfjs-dist@4.9.155 jszip mammoth
 */

import type { TextItem } from "pdfjs-dist/types/src/display/api";

/* ── .txt / .md ─────────────────────────────────────────────── */
function lerComoTexto(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      let texto = (e.target?.result as string) ?? "";
      if (file.name.toLowerCase().endsWith(".md")) {
        texto = texto.replace(/^#{1,6}\s+/gm, "");
      }
      resolve(texto.trim());
    };
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsText(file, "utf-8");
  });
}

/* ── .docx / .doc / .odf ────────────────────────────────────── */
async function lerDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  if (result.value.trim()) return result.value.trim();
  return lerComoTexto(file);
}

/* ── .pdf ───────────────────────────────────────────────────── */
async function lerPdf(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");

  // Aponta para o worker que vem dentro do próprio pacote.
  // O webpack do Next.js resolve o new URL(...) e copia o arquivo
  // automaticamente — sem CDN, sem configuração extra.
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.mjs",
      import.meta.url
    ).toString();
  }

  const arrayBuffer = await file.arrayBuffer();

  let pdf: Awaited<ReturnType<typeof pdfjsLib.getDocument>["promise"]>;
  try {
    pdf = await pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "erro desconhecido";
    throw new Error(`Não foi possível ler o PDF: ${msg}`);
  }

  const paginas: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    let ultimoY: number | null = null;
    const linhas: string[] = [];
    const linhaAtual: string[] = [];

    for (const item of content.items) {
      if (!("str" in item)) continue;
      const textItem = item as TextItem;
      if (!textItem.str) continue;

      const y = Math.round(textItem.transform[5]);

      if (ultimoY !== null && Math.abs(y - ultimoY) > 3) {
        const linha = linhaAtual.join("").trim();
        if (linha) linhas.push(linha);
        linhaAtual.length = 0;
      }

      linhaAtual.push(textItem.str);
      ultimoY = y;
    }

    const ultima = linhaAtual.join("").trim();
    if (ultima) linhas.push(ultima);

    paginas.push(linhas.join("\n"));
  }

  return paginas.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

/* ── .odt ───────────────────────────────────────────────────── */
async function lerOdt(file: File): Promise<string> {
  const { default: JSZip } = await import("jszip");
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const contentFile = zip.file("content.xml");
  if (!contentFile) throw new Error("Arquivo ODT inválido: content.xml não encontrado.");

  const xml = await contentFile.async("string");

  return xml
    .replace(/<text:line-break[^/]*/g, "\n")
    .replace(/<text:p[^>]*>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, h: string) =>
      String.fromCharCode(parseInt(h, 16))
    )
    .replace(/&#(\d+);/g, (_, d: string) =>
      String.fromCharCode(parseInt(d, 10))
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ── .rtf ───────────────────────────────────────────────────── */
async function lerRtf(file: File): Promise<string> {
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) ?? "");
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo RTF."));
    reader.readAsText(file, "latin1");
  });

  let s = raw;

  // 1. Descarta tudo antes do primeiro \pard ou \sectd —
  //    cabeçalhos Aspose/Word colocam lixo binário antes do texto real.
  const inicioTexto = s.search(/\\pard\b|\\sectd\b/i);
  if (inicioTexto !== -1) {
    s = s.slice(inicioTexto);
  }

  // 2. Remove blocos binários \binN (N bytes de dados binários)
  s = s.replace(/\\bin\d+\s?[\s\S]{0,4096}/g, "");

  // 3. Remove grupos de lixo conhecidos com possível aninhamento simples
  const gruposLixo = [
    "fonttbl", "colortbl", "stylesheet", "info", "pict",
    "header", "footer", "headerl", "headerr", "footerl", "footerr",
    "fldinst", "themedata", "colorschememapping", "latentstyles",
    "mmathPr", "compat", "defchp", "defpap",
  ];
  for (const g of gruposLixo) {
    const re = new RegExp(`\\{\\\\${g}[^{}]*(?:\\{[^{}]*\\}[^{}]*)*\\}`, "gi");
    s = s.replace(re, "");
  }

  // 4. Remove grupos genéricos aninhados restantes (até estabilizar)
  let anterior = "";
  while (anterior !== s) {
    anterior = s;
    s = s.replace(/\{\\[a-z*][^{}]*\}/gi, "");
  }

  // 5. Converte comandos de layout em quebras de texto
  s = s
    .replace(/\\par(?:d)?\b/gi, "\n")
    .replace(/\\line\b/gi, "\n")
    .replace(/\\tab\b/gi, "\t")
    .replace(/\\page\b/gi, "\n\n")
    .replace(/\\sect\b/gi, "\n\n")
    .replace(/\\row\b/gi, "\n")
    .replace(/\\cell\b/gi, " | ");

  // 6. Remove comandos de controle restantes (\palavra ou \palavra-N)
  s = s.replace(/\\[a-z*]+\-?\d*[ \t]?/gi, "");

  // 7. Remove chaves e barras soltas
  s = s.replace(/[{}\\]/g, "");

  // 8. Decodifica \'XX (caracteres especiais RTF como \'e7 → ç)
  s = s.replace(/\\'([0-9a-fA-F]{2})/g, (_, hex: string) => {
    try { return String.fromCharCode(parseInt(hex, 16)); } catch { return ""; }
  });

  // 9. Remove sequências de números/lixo que sobram de headers binários
  //    (ex: "020206030504" — bytes do Aspose que escaparam)
  s = s.replace(/(?<!\w)[0-9a-f]{6,}(?!\w)/gi, "");

  // 10. Limpa linhas e espaços em excesso
  return s
    .split("\n")
    .map((l) => l.trim())
    .filter((l, i, arr) => l || (arr[i - 1] !== ""))  // remove linhas vazias duplas
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ── Dispatcher principal ───────────────────────────────────── */
export async function importarArquivo(file: File): Promise<string> {
  const nome = file.name.toLowerCase();

  if (nome.endsWith(".txt"))                                         return lerComoTexto(file);
  if (nome.endsWith(".md"))                                          return lerComoTexto(file);
  if (nome.endsWith(".docx") || nome.endsWith(".doc") ||
      nome.endsWith(".odf"))                                         return lerDocx(file);
  if (nome.endsWith(".pdf"))                                         return lerPdf(file);
  if (nome.endsWith(".odt"))                                         return lerOdt(file);
  if (nome.endsWith(".rtf"))                                         return lerRtf(file);

  const ext = nome.split(".").pop()?.toUpperCase() ?? "desconhecido";
  throw new Error(`Formato .${ext} não suportado.`);
}

export const FORMATOS_ACEITOS = ".txt,.md,.docx,.doc,.pdf,.odt,.odf,.rtf";