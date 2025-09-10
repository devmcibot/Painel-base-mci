import Topbar from "@/components/Topbar";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export default async function MedicoHome() {
  // Sessão no servidor
  const session = await getServerSession(authOptions);
  const medicoId = (session?.user as any)?.medicoId ?? null;

  return (
    <>
      {/* Topo fixo em todas as páginas do médico */}
      <Topbar />

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        <h1 className="text-xl font-semibold">Painel do Médico</h1>

        {!medicoId ? (
          <p className="text-gray-600">
            Este usuário não está vinculado a um médico.
          </p>
        ) : (
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <Link href="/medico/pacientes" className="underline">
                Pacientes
              </Link>
            </li>
            {/* Próximas rotas futuras */}
            {/* <li>
              <Link href="/medico/agenda" className="underline">
                Agenda / Consultas
              </Link>
            </li> */}
          </ul>
        )}
      </main>
    </>
  );
}
