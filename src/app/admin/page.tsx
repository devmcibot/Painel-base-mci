import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import LogoutButton from "../../components/LogoutButton"; // <= AQUI

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/admin");

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-semibold">Admin • MCI</h1>
        <LogoutButton />
      </div>

      <p className="mb-4">Área administrativa (apenas ADMIN).</p>
      <ul className="list-disc pl-5 text-sm">
        <li>
          <a className="underline" href="/admin/users">
            Gerenciar usuários
          </a>
        </li>
      </ul>
    </div>
  );
}
