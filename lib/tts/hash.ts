/**
 * lib/tts/hash.ts
 *
 * Hash SHA-256 do conteúdo para detectar edições com precisão.
 * Usa a Web Crypto API nativa — sem dependências externas,
 * compatível com Node.js 18+ e Edge Runtime.
 *
 * Importada por:
 *   - app/api/tts/gerar/route.ts
 *   - app/api/tts/invalidar/route.ts
 *
 * NUNCA duplique esta função em outros módulos.
 */

export async function computarHashConteudo(conteudo: string): Promise<string> {
  const bytes = new TextEncoder().encode(conteudo);
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}