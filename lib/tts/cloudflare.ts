/**
 * lib/tts/cloudflare.ts
 *
 * Purga programática do cache Cloudflare para URLs de áudio TTS.
 * Chamada fire-and-forget logo após cada upload bem-sucedido para o R2,
 * garantindo que o próximo acesso sirva o arquivo recém-gerado.
 *
 * Requer as variáveis de ambiente:
 *   CF_ZONE_ID   — Zone ID do domínio (não é o Account ID)
 *   CF_API_TOKEN — API Token com permissão "Cache Purge" na zona
 */

/**
 * Purga uma ou mais URLs do cache de borda do Cloudflare.
 *
 * Retorna true se a purga foi aceita (HTTP 200), false em qualquer falha.
 * Nunca lança exceção — adequado para uso fire-and-forget.
 */
export async function purgarCacheCloudflare(urls: string[]): Promise<boolean> {
  const zoneId   = process.env.CF_ZONE_ID;
  const apiToken = process.env.CF_API_TOKEN;

  if (!zoneId || !apiToken) {
    console.warn("[CF Purge] CF_ZONE_ID ou CF_API_TOKEN ausentes — purga ignorada.");
    return false;
  }

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiToken}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify({ files: urls }),
      }
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "(sem body)");
      console.error(`[CF Purge] HTTP ${res.status}: ${body}`);
      return false;
    }

    const json = await res.json() as { success: boolean; errors?: unknown[] };

    if (!json.success) {
      console.error("[CF Purge] API retornou success=false:", json.errors);
      return false;
    }

    console.log(`[CF Purge] Purga aceita para: ${urls.join(", ")}`);
    return true;
  } catch (err) {
    console.error("[CF Purge] Erro inesperado:", err);
    return false;
  }
}