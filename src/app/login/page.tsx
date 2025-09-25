// src/app/login/page.tsx
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: { callbackUrl?: string };
};

export default async function LoginPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);

  // Se já logado, manda pro painel correto (ou callbackUrl, se veio)
  if (session?.user) {
    const role = (session.user as { role?: "ADMIN" | "MEDICO" | "MÉDICO" | string })?.role;
    const fallback = role === "ADMIN" ? "/admin" : "/medico";
    redirect(searchParams?.callbackUrl || fallback);
  }

  const callbackUrl = searchParams?.callbackUrl ?? "/admin";

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm bg-white shadow rounded-xl p-6 space-y-4">
        <h1 className="text-xl font-semibold text-center">Entrar no MCI</h1>
        <LoginForm callbackUrl={callbackUrl} defaultEmail="admin@mci.dev.br" />
        <p className="text-xs text-center">Use o admin seedado para o primeiro acesso.</p>
      </div>
    </main>
  );
}
