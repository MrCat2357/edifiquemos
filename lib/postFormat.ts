export function formatPostMeta(post: any) {
  const data =
    post.data?.toDate?.() ??
    post.data ??
    new Date();

  const dataStr = new Date(data).toLocaleDateString("pt-BR");

  const tipo = post.tipo;

  // 📖 Estudo
  if (tipo === "artigo") {
    return `Estudo publicado por ${post.autorNome || "Autor"} em ${dataStr}`;
  }

  // ✝️ SERMÃO
  const igreja = post.igreja?.trim();

  if (igreja && dataStr) {
    return `Sermao pregado na igreja ${igreja} em ${dataStr}`;
  }

  if (igreja) {
    return `Sermao pregado na igreja ${igreja}`;
  }

  return `Sermao publicado em ${dataStr}`;
}