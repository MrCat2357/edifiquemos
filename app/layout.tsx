import "./globals.css";
import HeaderWrapper from "@/components/HeaderWrapper";

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
        <HeaderWrapper />
        <main className="pt-[72px] w-full min-w-0 overflow-x-hidden">
          {children}
        </main>
      </body>
    </html>
  );
}