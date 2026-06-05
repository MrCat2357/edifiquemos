/**
 * lib/tts/hash.ts
 *
 * Função de hash leve para detectar edições de conteúdo.
 * Determinística, sem dependências externas, suficiente para
 * identificar se o texto foi alterado desde a última geração de áudio.
 *
 * Importada tanto por app/api/tts/gerar/route.ts quanto por
 * app/api/tts/invalidar/route.ts — NUNCA duplique esta função.
 */

export function computarHashConteudo(conteudo: string): string {
  return `${conteudo.slice(0, 200)}|${conteudo.length}|${conteudo.slice(-1)}`;
}