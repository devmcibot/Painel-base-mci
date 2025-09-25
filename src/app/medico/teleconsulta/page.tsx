// src/app/medico/teleconsulta/page.tsx
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import TeleChooser from "./tele-chooser";
import Call from "./Call";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: { pacienteId?: string; consultaId?: string };
};

export default async function TeleConsultaPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/medico/teleconsulta");

  const medicoId = (session.user as { medicoId?: number | null }).medicoId ?? null;
  if (!medicoId) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-semibold">Tele-Consulta</h1>
        <p className="text-sm text-red-600 mt-2">Usuário não vinculado a médico.</p>
      </main>
    );
  }

  const pacienteId = Number(searchParams?.pacienteId || 0) || null;
  const consultaId = Number(searchParams?.consultaId || 0) || null;

  // Pacientes do médico (para o select)
  const pacientes = await prisma.paciente.findMany({
    where: { medicoId },
    select: { id: true, nome: true, cpf: true },
    orderBy: { nome: "asc" },
  });

  // Consultas do paciente selecionado (para o select)
  const consultas = pacienteId
    ? await prisma.consulta.findMany({
        where: { pacienteId },
        select: { id: true, data: true, pacienteId: true },
        orderBy: { data: "desc" },
      })
    : [];

  // Se ambos selecionados → confirme metadados e renderize a call
  if (pacienteId && consultaId) {
    const c = await prisma.consulta.findFirst({
      where: { id: consultaId, pacienteId },
      select: {
        id: true,
        paciente: { select: { id: true, nome: true, cpf: true, medicoId: true } },
      },
    });

    if (c?.paciente && c.paciente.medicoId === medicoId) {
      return (
        <main className="max-w-5xl mx-auto p-6 space-y-6">
          <h1 className="text-2xl font-semibold">Tele-Consulta</h1>
          <Call
            medicoId={c.paciente.medicoId}
            pacienteId={c.paciente.id}
            nome={c.paciente.nome}
            cpf={c.paciente.cpf}
            consultaId={consultaId}
          />
        </main>
      );
    }
  }

  // Caso contrário: mostra seletor
  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Tele-Consulta</h1>
      <TeleChooser
        pacientes={pacientes.map((p) => ({ id: p.id, nome: p.nome, cpf: p.cpf }))}
        consultas={consultas.map((c) => ({ id: c.id, dataISO: c.data.toISOString() }))}
        selectedPacienteId={pacienteId}
        selectedConsultaId={consultaId}
      />
    </main>
  );
}
