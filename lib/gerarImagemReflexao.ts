/**
 * lib/gerarImagemReflexao.ts
 *
 * Busca uma imagem de capa no Unsplash baseada no microtema da reflexão.
 * Retorna a URL da imagem + dados de atribuição do fotógrafo (obrigatório
 * pelos termos do Unsplash).
 */

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY!;

export interface ImagemReflexao {
  url: string;
  fotografoNome: string;
  fotografoUrl: string;
  unsplashUrl: string;
}

function extrairTermoBusca(tituloReflexao: string): string {
  const titulo = tituloReflexao.toLowerCase();

  if (titulo.match(/paz|peace|tranquil/)) return "peaceful nature light";
  if (titulo.match(/missão|mission|propósito|purpose/)) return "path road journey";
  if (titulo.match(/fé|faith|crer|believe/)) return "light hope sky";
  if (titulo.match(/oração|prayer|pray/)) return "hands prayer meditation";
  if (titulo.match(/graça|grace|misericórdia|mercy/)) return "sunrise golden light";
  if (titulo.match(/amor|love|ágape/)) return "warm light nature";
  if (titulo.match(/esperança|hope/)) return "dawn sunrise horizon";
  if (titulo.match(/perdão|forgiveness/)) return "open hands light";
  if (titulo.match(/identidade|identity|posição|position/)) return "mountain peak above clouds";
  if (titulo.match(/vocação|calling|vocation/)) return "open road horizon sky";
  if (titulo.match(/palavra|word|bíblia|bible|scripture/)) return "open book light";
  if (titulo.match(/igreja|church|comunidade|community/)) return "church architecture light";
  if (titulo.match(/sofrimento|suffering|dor|pain/)) return "rain storm dramatic sky";
  if (titulo.match(/vitória|victory|superar|overcome/)) return "mountain summit achievement";
  if (titulo.match(/sabedoria|wisdom/)) return "ancient tree roots forest";
  if (titulo.match(/família|family|lar|home/)) return "warm home family light";

  return "nature light spiritual peaceful";
}

export async function gerarImagemReflexao(
  tituloReflexao: string,
  imagemCapaFallback: string
): Promise<ImagemReflexao> {
  try {
    const termo = extrairTermoBusca(tituloReflexao);
    const url = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(termo)}&orientation=landscape&content_filter=high`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
        "Accept-Version": "v1",
      },
    });

    if (!res.ok) {
      console.warn("[gerarImagemReflexao] Unsplash retornou:", res.status);
      return fallback(imagemCapaFallback);
    }

    const data = await res.json();

    // Dispara o evento de download obrigatório pelos termos do Unsplash
    if (data.links?.download_location) {
      fetch(`${data.links.download_location}&client_id=${UNSPLASH_ACCESS_KEY}`)
        .catch(() => {});
    }

    const appName = "Edifiquemos";
    const fotografoNome: string = data.user?.name ?? "Unsplash";
    const fotografoUrl: string =
      `${data.user?.links?.html ?? "https://unsplash.com"}?utm_source=${appName}&utm_medium=referral`;
    const unsplashUrl = `https://unsplash.com/?utm_source=${appName}&utm_medium=referral`;
    const imageUrl: string = data.urls?.regular ?? data.urls?.full ?? imagemCapaFallback;

    return { url: imageUrl, fotografoNome, fotografoUrl, unsplashUrl };
  } catch (err) {
    console.warn("[gerarImagemReflexao] Erro:", err);
    return fallback(imagemCapaFallback);
  }
}

function fallback(imagemCapaFallback: string): ImagemReflexao {
  return {
    url: imagemCapaFallback,
    fotografoNome: "",
    fotografoUrl: "",
    unsplashUrl: "",
  };
}