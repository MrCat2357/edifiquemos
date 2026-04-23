import React from "react";
import "./globals.css";
import Header from "@/components/Header";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-br">
      <body>
        <Header />

        <main className="max-w-2xl mx-auto p-4">
          {children}
        </main>

        <footer className="text-center text-sm text-gray-500 py-6">
          © {new Date().getFullYear()} Sermões
        </footer>
      </body>
    </html>
  );
}