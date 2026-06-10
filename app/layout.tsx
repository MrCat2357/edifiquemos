import "./globals.css";
import HeaderWrapper from "@/components/HeaderWrapper";
import { AudioProvider } from "@/providers/AudioProvider";
import GlobalAudioPlayer from "@/components/audio/GlobalAudioPlayer";

export const metadata = {
  title: "Voz da Fé",
  description: "Compartilhe e leia sermões e reflexões cristãs",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-neutral-900 text-neutral-100 min-h-screen">
        {/*
          Garante que --header-h tenha sempre um valor padrão seguro.
          HeaderWrapper deve sobrescrever essa variável ao montar via JS,
          mas este fallback evita o "corte" visível antes da hidratação.
        */}
        <style>{`
          :root {
            --header-h: 64px;
          }
        `}</style>

        <AudioProvider>
          <HeaderWrapper />

          {/*
            paddingTop usa var(--header-h) com fallback explícito de 64px
            para garantir que o conteúdo nunca fique por baixo do header,
            mesmo antes do JS calcular o valor real.

            paddingRight é ajustado pelo GlobalAudioPlayer via CSS
            quando a sidebar desktop aparece.
          */}
          <main
            style={{
              paddingTop: "var(--header-h, 64px)",
              width: "100%",
              minWidth: 0,
              overflowX: "hidden",
              transition: "padding-right 250ms cubic-bezier(0.32, 0.72, 0, 1)",
            }}
          >
            {children}
          </main>

          {/*
            GlobalAudioPlayer renderiza fora do <main> para permanecer
            fixo independente da rota.

            Fase 5:
              • Mobile  (<1024px): MiniPlayer + ExpandedPlayer
              • Desktop (≥1024px): NowPlayingSidebar
          */}
          <GlobalAudioPlayer />
        </AudioProvider>
      </body>
    </html>
  );
}