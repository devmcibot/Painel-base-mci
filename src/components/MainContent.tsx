// app/MainContent.tsx

"use client"; // Importante: torna este um Client Component

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export default function MainContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Verifica se a rota atual é a raiz ("/")
  const isHomePage = pathname === "/";

  // Define as classes com base na verificação
  const containerClasses = isHomePage
    ? "" // Se for a página inicial, não aplica classes de layout
    : "w-full pl-64 pr-8 py-16"; // Para as outras páginas, aplica o espaçamento

  return <main className={containerClasses}>{children}</main>;
}
