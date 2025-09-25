"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function LoginForm({
  callbackUrl,
  defaultEmail,
}: {
  callbackUrl: string;
  defaultEmail?: string;
}) {
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

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
      setErr(res.error === "CredentialsSignin" ? "E-mail ou senha inválidos" : res.error);
      return;
    }
    router.push(callbackUrl || "/admin");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {err && <div className="text-sm text-red-600">{err}</div>}

      <div className="space-y-1">
        <label className="text-sm">E-mail</label>
        <input
          className="w-full border rounded px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="seuemail@exemplo.com"
          required
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
          required
        />
      </div>

      <button className="w-full bg-black text-white rounded py-2">Entrar</button>
    </form>
  );
}
