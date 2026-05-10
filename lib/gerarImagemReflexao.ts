/**
 * lib/gerarImagemReflexao.ts
 *
 * Gera uma URL de imagem de capa via Pollinations.ai com base no microtema
 * de cada reflexão. Sem chave de API, sem custo.
 *
 * Estratégia:
 * 1. Monta um prompt visual em inglês a partir do título/tema da reflexão
 * 2. Faz um fetch HEAD para verificar se a Pollinations respondeu (timeout 8s)
 * 3. Se falhar, retorna a imagemCapaFallback (imagem do sermão original)
 */

const BASE_URL = "https://image.pollinations.ai/prompt";

/**
 * Converte o título de uma reflexão num prompt visual adequado
 * para imagens pastorais/espirituais.
 */
function montarPromptVisual(tituloReflexao: string): string {
  // Instrução em inglês: Pollinations performa melhor com prompts em EN
  return (
    `Cinematic Christian pastoral photograph. Theme: "${tituloReflexao}". ` +
    "Soft golden light rays through dark forest or ancient stone chapel. " +
    "Mist, depth, solemnity. No text, no people, no crosses as clichés. " +
    "Aspect ratio 1200x630. Ultra-realistic, award-winning photography."
  );
}

/**
 * Retorna a URL da imagem gerada pela Pollinations.
 * Faz um fetch HEAD para validar antes de retornar.
 * Se falhar dentro do timeout, retorna o fallback.
 */
export async function gerarImagemReflexao(
  tituloReflexao: string,
  imagemCapaFallback: string
): Promise<string> {
  try {
    const prompt = encodeURIComponent(montarPromptVisual(tituloReflexao));
    // seed baseado no título garante imagens diferentes por reflexão,
    // mas determinísticas (boa para cache/og:image estável)
    const seed = hashSimples(tituloReflexao);
    const url = `${BASE_URL}/${prompt}?width=1200&height=630&nologo=true&seed=${seed}&model=flux`;

    // Valida se a Pollinations está acessível (timeout de 8s)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok || res.status === 200) {
      return url;
    }

    console.warn("[gerarImagemReflexao] Pollinations retornou status:", res.status);
    return imagemCapaFallback;
  } catch (err) {
    console.warn("[gerarImagemReflexao] Falha ao verificar imagem, usando fallback:", err);
    return imagemCapaFallback;
  }
}

/**
 * Hash numérico simples de uma string (djb2).
 * Usado como seed para tornar a imagem determinística por título.
 */
function hashSimples(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return Math.abs(hash >>> 0);
}