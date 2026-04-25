import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "./firebase";

export function gerarSlugBase(autorNome: string, titulo: string): string {
  const texto = `${autorNome} ${titulo}`;
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export async function gerarSlugUnico(autorNome: string, titulo: string): Promise<string> {
  const base = gerarSlugBase(autorNome, titulo);

  const q = query(collection(db, "posts"), where("slug", ">=", base), where("slug", "<=", base + "\uf8ff"));
  const snap = await getDocs(q);

  const slugsExistentes = snap.docs.map((d) => d.data().slug as string);

  if (!slugsExistentes.includes(base)) return base;

  let i = 2;
  while (slugsExistentes.includes(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}