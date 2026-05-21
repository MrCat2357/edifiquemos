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
          AudioProvider é um Client Component mas pode envolver
          um Server Component normalmente — o Next.js trata isso corretamente.
          O <audio> real vive dentro do Provider via useEffect (client-only).
        */}
        <AudioProvider>
          <HeaderWrapper />
          <main
            style={{
              paddingTop: "var(--header-h)",
              width: "100%",
              minWidth: 0,
              overflowX: "hidden",
            }}
          >
            {children}
          </main>

          {/*
            GlobalAudioPlayer é renderizado aqui, fora do <main>,
            para que fique fixo independente da rota atual.
            Ele só aparece quando há uma publicação carregada (current !== null).
          */}
          <GlobalAudioPlayer />
        </AudioProvider>
      </body>
    </html>
  );
}