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
      <main className="min-h-screen bg-[#F7F9FC] p-8 md:p-10">
        <header className="mb-6">
          <h1 className="text-2xl md:text-3xl font-semibold text-[#1E63F3]">Tele-Consulta</h1>
          <p className="text-gray-500 mt-1">Usuário não vinculado a médico.</p>
        </header>

        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-gray-700">
            Faça login com um usuário de médico para iniciar uma tele-consulta.
          </p>
        </section>
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
        <main className="min-h-screen bg-[#F7F9FC] p-8 md:p-10 space-y-6">
          <header>
            <h1 className="text-2xl md:text-3xl font-semibold text-[#1E63F3]">Tele-Consulta</h1>
            <p className="text-gray-500 mt-1">
              Sessão de vídeo com o paciente selecionado.
            </p>
          </header>

          <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-3 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-[#1E63F3]">
                Chamada em andamento
              </h2>
            </div>
            <div className="p-4 md:p-6">
              <Call
                medicoId={c.paciente.medicoId}
                pacienteId={c.paciente.id}
                nome={c.paciente.nome}
                cpf={c.paciente.cpf}
                consultaId={consultaId}
              />
            </div>
          </section>
        </main>
      );
    }
  }

  // Caso contrário: mostra o seletor (escolha de paciente/consulta)
  return (
    <main className="min-h-screen bg-[#F7F9FC] p-8 md:p-10 space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl font-semibold text-[#1E63F3]">Tele-Consulta</h1>
        <p className="text-gray-500 mt-1">
          Selecione o paciente e a consulta para iniciar a chamada.
        </p>
      </header>

      <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-[#1E63F3]">Seleção</h2>
        </div>
        <div className="p-4 md:p-6">
          <TeleChooser
            pacientes={pacientes.map((p) => ({ id: p.id, nome: p.nome, cpf: p.cpf }))}
            consultas={consultas.map((c) => ({ id: c.id, dataISO: c.data.toISOString() }))}
            selectedPacienteId={pacienteId}
            selectedConsultaId={consultaId}
          />
        </div>
      </section>
    </main>
  );
}
