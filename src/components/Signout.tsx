"use client";
import { useSession, signOut } from "next-auth/react";

const SignOut = () => {
  const { data } = useSession();
  const user = data?.user as any | undefined;
  return (
    <div className="flex items-center gap-8">
      {user?.name && (
        <>
          <span className="capitalize font-semibold">Olá Dr. {user?.name}</span>

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
        </>
      )}
    </div>
  );
};
export default SignOut;
