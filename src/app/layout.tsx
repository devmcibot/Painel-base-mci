import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

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
          <main className={`w-full pl-64 pr-8 py-16`}>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
