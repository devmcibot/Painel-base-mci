// src/app/login/page.tsx
"use client";
import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("admin@mci.dev.br");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const sp = useSearchParams();
  const router = useRouter();
  const callbackUrl = sp.get("callbackUrl") || "/admin";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });
    if (res?.error) {
      setErr(
        res.error === "CredentialsSignin"
          ? "E-mail ou senha inválidos"
          : res.error
      );
      return;
    }
    router.push(callbackUrl);
  }

  return (
    <div className="w-full h-dvh flex items-center justify-center">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm py-12 px-8 shadow-2xl rounded-xl space-y-4"
      >
        <h1 className="text-xl font-semibold">Entrar no MCI</h1>
        {err && <div className="text-sm text-red-600">{err}</div>}

        <div className="space-y-1">
          <label className="text-sm">E-mail</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="seuemail@exemplo.com"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm">Senha</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="••••••••"
          />
        </div>

        <button className="w-full bg-black text-white rounded py-2">
          Entrar
        </button>
        <p className="text-xs">Use o admin seedado para o primeiro acesso.</p>
      </form>
    </div>
  );
}
