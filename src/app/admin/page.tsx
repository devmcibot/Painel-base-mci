import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/admin");

  return (
    <div>
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
