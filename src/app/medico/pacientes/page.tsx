import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

type PatientRow = {
  id: number;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  nascimento: Date | null;
};

export default async function PacientesPage() {
  const session = await getServerSession(authOptions);
  const medicoId = (session?.user as any)?.medicoId ?? null;

  if (!medicoId) {
    return (
      <main className="min-h-screen bg-[#F7F9FC] p-8 md:p-10">
        <h1 className="text-2xl md:text-3xl font-semibold text-[#1E63F3]">
          Pacientes
        </h1>
        <p className="text-gray-500 mt-1">Somente médicos podem acessar.</p>
      </main>
    );
  }

  const pacientes = await prisma.paciente.findMany({
    where: { medicoId },
    orderBy: { id: "asc" },
    select: {
      id: true,
      nome: true,
      cpf: true,
      telefone: true,
      email: true,
      nascimento: true,
    },
  });

  const PatientsTableClient = (await import("./PatientsTableClient")).default;

  return (
    <main className="min-h-screen bg-[#F7F9FC] p-8 md:p-10">
      {/* Cabeçalho */}
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-[#1E63F3]">
            Pacientes
          </h1>
          <p className="text-gray-500 mt-1">Gerencie sua base de pacientes.</p>
        </div>
        <Link
          href="/medico/pacientes/novo"
          className="px-4 py-2 rounded-lg bg-[#1E63F3] text-white hover:bg-[#0F4CCF]"
        >
          Adicionar paciente
        </Link>
      </header>

      {/* Tabela */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden p-4 md:p-6">
        <PatientsTableClient items={pacientes as PatientRow[]} />
      </section>
    </main>
  );
}
