"use client";

import { useEffect, useState } from "react";
import { collection, getCountFromServer } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function Estatisticas() {
  const [totalPosts, setTotalPosts] = useState<number | null>(null);
  const [totalUsuarios, setTotalUsuarios] = useState<number | null>(null);

  useEffect(() => {
    async function carregarEstatisticas() {
      try {
        // Contar posts
        const postsSnapshot = await getCountFromServer(
          collection(db, "posts")
        );

        // Contar usuários
        const usersSnapshot = await getCountFromServer(
          collection(db, "users")
        );

        setTotalPosts(postsSnapshot.data().count);
        setTotalUsuarios(usersSnapshot.data().count);

      } catch (error) {
        console.error("Erro ao carregar estatísticas:", error);
      }
    }

    carregarEstatisticas();
  }, []);

  return (
    <div
      style={{
        padding: 30,
        fontSize: 28,
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <div>
        📖 Total de posts: {totalPosts ?? "Carregando..."}
      </div>

      <div>
        👥 Total de usuários: {totalUsuarios ?? "Carregando..."}
      </div>
    </div>
  );
}