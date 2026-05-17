import type { ReflexaoGerada } from "./reflexoes";

// ─────────────────────────────────────────────
// Prompt enviado à IA
// ─────────────────────────────────────────────

function montarPrompt(conteudoOriginal: string, tituloOriginal: string): string {
  return `Você é um assistente pastoral. Com base no sermão/artigo abaixo, gere exatamente 3 reflexões independentes para compartilhamento no WhatsApp ao longo da semana.

TÍTULO ORIGINAL: ${tituloOriginal}

CONTEÚDO ORIGINAL:
${conteudoOriginal}

─────────────────────────────────────────
REGRAS OBRIGATÓRIAS:
1. Cada reflexão deve explorar um microtema diferente extraído do sermão acima.
2. Cada reflexão deve ter entre 2 e 4 minutos de leitura (300–600 palavras no campo "conteudo").
3. Use apenas conteúdo presente no sermão — não invente doutrinas, versículos ou histórias.
4. Linguagem pastoral e profunda, sem tom de marketing.
5. Não conclua totalmente o assunto — deixe o leitor querendo aprofundar.
6. A "fraseInstigadora" deve ter no máximo 280 caracteres e ser instigante, não conclusiva.
7. O "ctaTexto" deve ter no máximo 5 palavras (ex: "Continue essa reflexão aqui").
8. O "titulo" deve ser curto, forte e diferente do título original.
9. Responda APENAS com JSON válido, sem texto antes ou depois, sem blocos de código markdown.

─────────────────────────────────────────
FORMATO DE RESPOSTA (array com exatamente 3 objetos):
[
  {
    "titulo": "Título curto e forte",
    "conteudo": "Texto da reflexão em prosa simples, 300–600 palavras, sem markdown, parágrafos separados por \\n\\n",
    "fraseInstigadora": "Frase instigadora de até 280 caracteres para o WhatsApp",
    "perguntaReflexiva": "Uma pergunta que provoca reflexão pessoal",
    "ctaTexto": "Até 5 palavras de CTA"
  },
  {},
  {}
]`;
}

// ─────────────────────────────────────────────
// Chamada à API Groq
// ─────────────────────────────────────────────

export async function gerarReflexoesIA(
  conteudoOriginal: string,
  tituloOriginal: string
): Promise<ReflexaoGerada[]> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 4000,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content:
            "Você é um assistente pastoral especializado em reflexões cristãs. " +
            "Responda SEMPRE e SOMENTE com JSON válido, sem nenhum texto antes ou depois, " +
            "sem blocos de código markdown, sem explicações.",
        },
        {
          role: "user",
          content: montarPrompt(conteudoOriginal, tituloOriginal),
        },
      ],
    }),
  });

  if (!response.ok) {
    const erro = await response.text();
    throw new Error(`Erro na API Groq: ${response.status} — ${erro}`);
  }

  const data = await response.json();
  const textoResposta: string = data.choices?.[0]?.message?.content ?? "";

  if (!textoResposta) {
    throw new Error("Groq não retornou conteúdo. Tente novamente.");
  }

  let reflexoes: ReflexaoGerada[];
  try {
    const limpo = textoResposta
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();
    reflexoes = JSON.parse(limpo);
  } catch {
    throw new Error("A IA não retornou um JSON válido. Tente novamente.");
  }

  if (!Array.isArray(reflexoes) || reflexoes.length !== 3) {
    throw new Error("A IA não retornou exatamente 3 reflexões.");
  }

  for (const r of reflexoes) {
    if (!r.titulo || !r.conteudo || !r.fraseInstigadora || !r.ctaTexto) {
      throw new Error("Uma das reflexões está com campos faltando.");
    }
    if (r.fraseInstigadora.length > 280) {
      r.fraseInstigadora = r.fraseInstigadora.slice(0, 277) + "...";
    }
  }

  return reflexoes;
}