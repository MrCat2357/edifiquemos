import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { conteudo } = await req.json();

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 32000,
      messages: [
        {
          role: "user",
          content: `Você receberá um texto extraído de um PDF. Por causa disso, ele pode ter linhas quebradas artificialmente no meio de frases e parágrafos mal separados.

Faça as seguintes correções:
1. Una as linhas quebradas artificialmente, juntando palavras e frases que foram cortadas no meio por causa do layout do PDF. O critério é simples: se uma linha não termina com pontuação final (ponto, exclamação, interrogação, dois-pontos, reticências), ela deve ser unida à linha seguinte.
2. Garanta exatamente uma linha em branco entre cada parágrafo.
3. Corrija erros de gramática, ortografia e pontuação.
4. NÃO altere o conteúdo, estilo, vocabulário teológico nem a estrutura do texto.
5. NÃO adicione nem remova parágrafos.
6. Retorne APENAS o texto corrigido, sem comentários, sem explicações, sem marcadores.

Texto:
${conteudo}`,
        },
      ],
    }),
  });

  const data = await response.json();
  console.log("STATUS:", response.status);
  console.log("RESPOSTA:", JSON.stringify(data, null, 2));

  const texto = data?.choices?.[0]?.message?.content ?? null;
  return NextResponse.json({ texto });
}