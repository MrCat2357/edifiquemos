"use client";

import Link from "next/link";

export default function TermosPage() {
  return (
    <div className="auth-page" style={{ alignItems: "flex-start", paddingTop: "calc(var(--header-h) + 2.5rem)" }}>

      <div style={{
        maxWidth: 680,
        width: "100%",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "2.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
      }}>

        <h1 style={{
          fontSize: "clamp(1.5rem, 3vw, 2rem)",
          fontWeight: 800,
          color: "var(--emerald)",
          letterSpacing: "-0.02em",
          lineHeight: 1.2,
        }}>
          Termos de Uso
        </h1>

        <hr className="post-detail-divider" />

        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          fontSize: "0.92rem",
          color: "var(--text-2)",
          lineHeight: 1.8,
        }}>
          <p>Este site é uma plataforma de compartilhamento de sermões, artigos e reflexões cristãs.</p>
          <p>Ao utilizar esta plataforma, o usuário declara ser responsável por todo conteúdo que publicar, garantindo que possui direitos sobre ele.</p>
          <p>Não é permitido publicar conteúdos ofensivos, ilegais, difamatórios ou que violem princípios éticos e cristãos.</p>
          <p>O conteúdo publicado pode ser moderado, editado ou removido pela administração da plataforma a qualquer momento, sem aviso prévio.</p>
          <p>A plataforma pode utilizar o endereço de e-mail do usuário para comunicações essenciais relacionadas ao funcionamento do serviço, como autenticação, segurança e notificações da conta.</p>
          <p>O usuário é o único responsável pelo uso que faz da plataforma e pelos conteúdos que publica.</p>
          <p>Este serviço encontra-se em fase de desenvolvimento e pode sofrer alterações, interrupções ou encerramento sem aviso prévio.</p>
        </div>

        <hr className="post-detail-divider" />

        <div>
          <Link href="/cadastro" className="read-link" style={{ marginLeft: 0 }}>
            ← Voltar para cadastro
          </Link>
        </div>

      </div>
    </div>
  );
}