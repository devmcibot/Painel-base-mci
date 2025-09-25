// app/layout.tsx

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import MainContent from "@/components/MainContent";

const inter = Inter({
  subsets: ["latin"],
  weight: ["200", "400", "600", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "MCI",
  description: "Meu Consultório Inteligente",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={inter.variable}>
        <Providers>
          {/* 2. Substitua a tag <main> pelo componente MainContent */}
          <MainContent>{children}</MainContent>
        </Providers>
      </body>
    </html>
  );
}
