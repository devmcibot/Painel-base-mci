"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

type UserLike = {
  name?: string | null;
  medicoId?: number | null;
};

export default function Topbar() {
  const { data } = useSession();
  const user = (data?.user as UserLike | undefined) ?? undefined;

  return (
    <header className="w-full border-b bg-white">
      <div className="max-w-5xl mx-auto flex items-center justify-between py-3 px-4">
        <Link href="/" className="font-semibold text-4xl">
          <span className="text-blue-primary">M</span>
          <span className="text-blue-primary">C</span>
          <span className="text-blue-secondary">I</span>
        </Link>
        <div className="flex items-center gap-8">
          {user?.name && (
            <span className="text-2xl capitalize font-semibold">Dr. {user.name}</span>
          )}
          <button title="sair" onClick={() => signOut()}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m16 17 5-5-5-5" />
              <path d="M21 12H9" />
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
