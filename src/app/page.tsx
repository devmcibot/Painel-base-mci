// app/page.tsx
import LoginForm from "@/components/LoginForm";
import { Suspense } from "react";

// Note que NÃO há "use client" aqui. Esta é a sua página principal.
export default function HomePage() {
  return (
    <main>
      {/* Você pode adicionar outros elementos de Server Component aqui se quiser */}

      <Suspense
        fallback={
          <div className="w-full h-dvh flex items-center justify-center">
            Carregando...
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}
