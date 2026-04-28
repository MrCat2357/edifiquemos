/**
 * Converte uma string em slug URL-amigável.
 * Ex: "Pr. Charles Spurgeon" → "pr-charles-spurgeon"
 */
export function slugify(text: string): string {
  return text
    .normalize("NFD")                        // decompõe acentos
    .replace(/[\u0300-\u036f]/g, "")         // remove diacríticos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")           // remove caracteres especiais
    .replace(/\s+/g, "-")                    // espaços → hífens
    .replace(/-+/g, "-")                     // hífens duplicados → um
    .replace(/^-|-$/g, "");                  // remove hífens nas bordas
}
