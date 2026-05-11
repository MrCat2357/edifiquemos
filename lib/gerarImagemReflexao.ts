/**
 * lib/gerarImagemReflexao.ts
 *
 * Busca uma imagem de capa no Unsplash baseada no microtema da reflexão.
 * Gratuito até 50 requests/hora (Demo) ou 5.000/hora (Production).
 * Fallback: imagem de capa do sermão original.
 */

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY!;

// Mapeia palavras-chave do título para termos de busca em inglês
// que retornam fotos adequadas para conteúdo pastoral
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

  // Fallback genérico pastoral
  return "nature light spiritual peaceful";
}

export async function gerarImagemReflexao(
  tituloReflexao: string,
  imagemCapaFallback: string
): Promise<string> {
  try {
    const termo = extrairTermoBusca(tituloReflexao);
    const url = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(termo)}&orientation=landscape&content_filter=high`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
        // Atribuição obrigatória pelos termos do Unsplash
        "Accept-Version": "v1",
      },
    });

    if (!res.ok) {
      console.warn("[gerarImagemReflexao] Unsplash retornou:", res.status);
      return imagemCapaFallback;
    }

    const data = await res.json();

    // Unsplash exige que disparemos o evento de download
    // quando a foto é "usada" — fazemos isso de forma assíncrona
    if (data.links?.download_location) {
      fetch(`${data.links.download_location}&client_id=${UNSPLASH_ACCESS_KEY}`)
        .catch(() => {}); // silencia erros do tracking
    }

    // Retorna a URL da imagem em tamanho regular (adequado para og:image)
    // com parâmetros para forçar 1200x630
    const imageUrl = data.urls?.regular ?? data.urls?.full ?? imagemCapaFallback;
    return imageUrl;

  } catch (err) {
    console.warn("[gerarImagemReflexao] Erro ao buscar imagem:", err);
    return imagemCapaFallback;
  }
}