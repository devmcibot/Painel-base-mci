"use client";

import { signOut } from "next-auth/react";

export default function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 transition"
    >
      Sair
    </button>
  );
}
