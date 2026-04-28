"use client";

import Link from "next/link";
import { useAuth } from "@/lib/useAuth";

export default function HomePage() {
  const { user } = useAuth();

  return (
    <section className="hero">
      <div className="hero-grid" />

      <div className="hero-content">
        <div className="hero-eyebrow">
          <span className="hero-eyebrow-dot" />
          Edificação Mútua
        </div>

        <h1 className="hero-title">
          Sermões e Reflexões
          <br />
          <span className="hero-title-accent">para Crescer na Fé</span>
        </h1>

        <blockquote className="hero-verse">
          "Por isso, exortem-se e edifiquem-se uns aos outros,
          como de fato vocês estão fazendo."
          <cite>1 Tessalonicenses 5:11</cite>
        </blockquote>

        <div className="hero-actions">
          <Link href="/posts" className="btn-hero-primary">
            Explorar Conteúdos
          </Link>
          {user ? (
            <Link href="/criar-post" className="btn-hero-secondary">
              Publicar Sermão ou Artigo
            </Link>
          ) : (
            <Link href="/login" className="btn-hero-secondary">
              Entrar para Publicar
            </Link>
          )}
        </div>

         {/* STATS DESATIVADOS TEMPORARIAMENTE — descomentar quando os números forem reais*/
        <div className="hero-stats">
          <div className="stat">
            <span className="stat-number">+240</span>
            <span className="stat-label">Sermões</span>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <span className="stat-number">+89</span>
            <span className="stat-label">Artigos</span>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <span className="stat-number">+1.2k</span>
            <span className="stat-label">Leitores</span>
          </div>
        </div>
        }
      </div>
    </section>
  );
}