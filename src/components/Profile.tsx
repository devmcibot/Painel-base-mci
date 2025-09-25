"use client";
import { useSession, signOut } from "next-auth/react";
import { LogOutIcon, UserIcon } from "./Icons";
import Link from "next/link";

const Profile = () => {
  const { data } = useSession();
  const user = data?.user as any | undefined;
  return (
    <>
      {user?.name && (
        <div className="flex flex-col gap-4">
          <span className="capitalize font-semibold">Olá Dr. {user?.name}</span>
          <div className="flex items-center gap-4">
            <button title="sair" onClick={() => signOut()}>
              <LogOutIcon />
            </button>
            <Link title="Minha conta" href={"/medico/perfil"}>
              <UserIcon />
            </Link>
          </div>
        </div>
      )}
    </>
  );
};
export default Profile;
