import "./globals.css";
import HeaderWrapper from "@/components/HeaderWrapper";

export const metadata = {
  title: "Voz da Fé",
  description: "Compartilhe e leia sermões e reflexões cristãs",
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

        <main className="max-w-3xl mx-auto px-4 py-8">
          {children}
        </main>

      </body>
    </html>
  );
}