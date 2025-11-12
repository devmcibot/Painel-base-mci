"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
    >
      Sair
    </button>
  );
}
