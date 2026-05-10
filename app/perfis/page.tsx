"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { useRouter } from "next/navigation";

function getInitials(name: string) {
  if (!name) return "?";
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function Avatar({ src, name, size = 56 }: { src?: string | null; name: string; size?: number }) {
  if (src) {
    return (
      <img src={src} alt={name} style={{
        width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0,
        boxShadow: "0 0 0 3px var(--emerald-dim)",
      }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "linear-gradient(135deg, var(--emerald-dark), var(--emerald))",
      color: "#fff", fontSize: Math.round(size * 0.36) + "px", fontWeight: 700,
      display: "flex", alignItems: "center", justifyContent: "center",
      userSelect: "none", boxShadow: "0 0 0 3px var(--emerald-dim)",
    }}>
      {getInitials(name)}
    </div>
  );
}

export default function PerfisPage() {
  const router = useRouter();
  const [perfis, setPerfis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    async function carregar() {
      try {
        const snap = await getDocs(query(collection(db, "users"), orderBy("nome")));
        const lista: any[] = [];
        snap.forEach((d) => {
          const data = d.data();
          if (data.nome) lista.push({ id: d.id, ...data });
        });
        setPerfis(lista);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    }
    carregar();
  }, []);

  const perfisFiltrados = perfis.filter((p) => {
    const termo = busca.toLowerCase();
    const nomeCompleto = p.titulo ? `${p.titulo} ${p.nome}` : p.nome;
    return (
      nomeCompleto?.toLowerCase().includes(termo) ||
      p.bio?.toLowerCase().includes(termo)
    );
  });

  return (
    <div style={{ paddingTop: "calc(var(--header-h) + 2rem)", paddingBottom: "4rem" }}>
      <div style={{ maxWidth: "680px", margin: "0 auto", padding: "0 1.25rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>

        {/* Cabeçalho */}
        <div>
          <h1 style={{ fontSize: "clamp(1.4rem, 3vw, 2rem)", fontWeight: 800, color: "var(--text-1)", letterSpacing: "-0.02em", marginBottom: "0.25rem" }}>
            Perfis
          </h1>
          <p style={{ fontSize: "0.875rem", color: "var(--text-3)" }}>
            Conheça os autores que publicam no Voz da Fé
          </p>
        </div>

        {/* Busca */}
        <input
          placeholder="Buscar por nome, título ou descrição..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="auth-input"
          style={{ fontSize: "0.9rem" }}
        />

        {/* Lista */}
        {loading ? (
          <div className="post-detail-loading">
            <div className="spinner" />
            Carregando perfis...
          </div>
        ) : perfisFiltrados.length === 0 ? (
          <div className="empty-state">
            {busca ? "Nenhum perfil encontrado para essa busca." : "Nenhum perfil cadastrado ainda."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {perfisFiltrados.map((perfil) => {
              const nomeExibicao = perfil.titulo
                ? `${perfil.titulo} ${perfil.nome}`
                : perfil.nome;
              const destino = perfil.slug
                ? `/perfil/${perfil.slug}`
                : `/perfil/${perfil.id}`;

              return (
                <div
                  key={perfil.id}
                  onClick={() => router.push(destino)}
                  style={{
                    display: "flex", alignItems: "center", gap: "1rem",
                    padding: "1rem 1.25rem",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-lg)",
                    cursor: "pointer", transition: "border-color 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--emerald)";
                    e.currentTarget.style.boxShadow = "0 0 0 1px var(--emerald-dim)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <Avatar src={perfil.fotoUrl} name={nomeExibicao} size={56} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-1)", margin: "0 0 0.2rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {nomeExibicao}
                    </p>
                    {perfil.bio ? (
                      <p style={{ fontSize: "0.8rem", color: "var(--text-3)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {perfil.bio}
                      </p>
                    ) : (
                      <p style={{ fontSize: "0.8rem", color: "var(--text-3)", margin: 0, fontStyle: "italic" }}>
                        Sem descrição.
                      </p>
                    )}
                  </div>

                  <span style={{ fontSize: "0.72rem", color: "var(--emerald)", fontWeight: 600, flexShrink: 0 }}>
                    Ver perfil →
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}