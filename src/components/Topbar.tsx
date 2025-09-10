"use client";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

export default function Topbar() {
  const { data } = useSession();
  const user = data?.user as any | undefined;

  return (
    <header className="w-full border-b bg-white">
      <div className="max-w-5xl mx-auto flex items-center justify-between py-3 px-4">
        <Link href="/" className="font-semibold">MCI</Link>

        <nav className="text-sm text-gray-700 flex gap-3">
          {user?.role === "ADMIN" && <Link href="/admin">Admin</Link>}
          {user?.role === "MEDICO" && <Link href="/medico">Médico</Link>}
        </nav>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {user?.name} • {user?.role}
          </span>
          <button
            onClick={() => signOut()}
            className="border rounded px-2 py-1 text-sm"
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
