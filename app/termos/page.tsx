"use client";

import Link from "next/link";

export default function TermosPage() {
  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 flex items-center justify-center px-4">

      <div className="max-w-2xl bg-neutral-800 border border-neutral-700 rounded-lg p-6 space-y-6">

        <h1 className="text-2xl font-bold text-emerald-300">
          Termos de Uso
        </h1>

        <div className="space-y-4 text-sm leading-relaxed text-neutral-300">

          <p>
            Este site é uma plataforma de compartilhamento de sermões, artigos e reflexões cristãs.
          </p>

          <p>
            Ao utilizar esta plataforma, o usuário declara ser responsável por todo conteúdo que publicar, garantindo que possui direitos sobre ele.
          </p>

          <p>
            Não é permitido publicar conteúdos ofensivos, ilegais, difamatórios ou que violem princípios éticos e cristãos.
          </p>

          <p>
            O conteúdo publicado pode ser moderado, editado ou removido pela administração da plataforma a qualquer momento, sem aviso prévio.
          </p>

          <p>
            A plataforma pode utilizar o endereço de e-mail do usuário para comunicações essenciais relacionadas ao funcionamento do serviço, como autenticação, segurança e notificações da conta.
          </p>

          <p>
            O usuário é o único responsável pelo uso que faz da plataforma e pelos conteúdos que publica.
          </p>

          <p>
            Este serviço encontra-se em fase de desenvolvimento e pode sofrer alterações, interrupções ou encerramento sem aviso prévio.
          </p>

        </div>

        {/* VOLTAR */}
        <div className="pt-4">
          <Link
            href="/cadastro"
            className="text-emerald-400 hover:underline cursor-pointer"
          >
            ← Voltar para cadastro
          </Link>
        </div>

      </div>
    </div>
  );
}