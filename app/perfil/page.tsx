"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { updateProfile } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export default function Perfil() {
  const [nome, setNome] = useState("");
  const [titulo, setTitulo] = useState("");

  // 📥 Carrega dados do usuário
  useEffect(() => {
    async function carregarUsuario() {
      if (!auth.currentUser) return;

      const user = auth.currentUser;

      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const data = snap.data();

          setNome(data.nome || "");
          setTitulo(data.titulo || "");
        } else {
          // fallback do Auth
          setNome(user.displayName || "");
          setTitulo("");
        }
      } catch (error) {
        console.error("Erro ao carregar usuário:", error);
      }
    }

    carregarUsuario();
  }, []);

  // 💾 Salvar perfil
  async function salvar() {
    if (!auth.currentUser) return;

    const user = auth.currentUser;

    try {
      // 🗄️ Atualiza Firestore (fonte principal)
      await updateDoc(doc(db, "users", user.uid), {
        nome,
        titulo,
      });

      // 🔥 Atualiza Auth (somente nome puro)
      await updateProfile(user, {
        displayName: nome,
      });

      alert("Perfil atualizado com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar perfil:", error);
      alert("Erro ao salvar perfil");
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <h1 className="text-2xl font-bold">Meu Perfil</h1>

      {/* TÍTULO */}
      <input
        className="border p-2 w-64"
        placeholder="Título (ex: Diácono, Presbítero)"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
      />

      {/* NOME */}
      <input
        className="border p-2 w-64"
        placeholder="Seu nome"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />

      {/* BOTÃO SALVAR */}
      <button
        onClick={salvar}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        Salvar
      </button>
    </div>
  );
}