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
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "user",
          content: `Corrija apenas os erros de gramática, ortografia e pontuação do texto abaixo. 
NÃO altere o conteúdo, estilo, vocabulário teológico nem a estrutura do texto.
NÃO adicione nem remova parágrafos.
Retorne APENAS o texto corrigido, sem comentários, sem explicações, sem marcadores.

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