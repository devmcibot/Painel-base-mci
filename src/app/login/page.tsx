// app/login/page.tsx
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// Evita SSG/ISR dessa página (opcional, mas ajuda a não preregistrar no build)
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: { callbackUrl?: string };
};

export default async function LoginPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);

  // Se já estiver logado, manda para o painel certo
  if (session?.user) {
    // Se veio callbackUrl, respeite; senão decide pelo papel
    const role = (session.user as any)?.role as "ADMIN" | "MEDICO" | "MÉDICO" | undefined;
    const fallback = role === "ADMIN" ? "/admin" : "/medico";
    redirect(searchParams?.callbackUrl || fallback);
  }

  const callback = searchParams?.callbackUrl;

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border p-6 space-y-4 bg-white">
        <h1 className="text-2xl font-semibold text-center">Entrar</h1>

        {/* Se você usa Credentials Provider com formulário, coloque aqui.
            Abaixo deixo um botão genérico que abre a tela padrão do NextAuth. */}
        <SignInButton callbackUrl={callback} />
      </div>
    </main>
  );
}

// ---- Client component: apenas o botão que chama signIn() ----
"use client";
import { signIn } from "next-auth/react";

function SignInButton({ callbackUrl }: { callbackUrl?: string }) {
  return (
    <button
      className="w-full rounded-xl border px-4 py-2 hover:bg-gray-50"
      onClick={() => signIn(undefined, { callbackUrl: callbackUrl || "/medico" })}
    >
      Entrar com provedor
    </button>
  );
}
