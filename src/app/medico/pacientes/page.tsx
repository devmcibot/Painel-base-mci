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
      <main className="p-6">
        <p>Somente médicos podem acessar.</p>
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
    <div className="">
      {/* Início */}
      <div className="mb-2">
        <Link
          href="/medico"
          className="inline-flex items-center gap-2 text-sm text-blue-700 underline"
        >
          &larr; Início
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pacientes</h1>
        <Link
          href="/medico/pacientes/novo"
          className="px-3 py-2 rounded bg-blue-primary text-white"
        >
          Adicionar paciente
        </Link>
      </div>

      <PatientsTableClient items={pacientes as PatientRow[]} />
    </div>
  );
}
