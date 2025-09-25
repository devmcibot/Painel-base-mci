// src/app/medico/teleconsulta/page.tsx
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import Call from "./Call";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: { pacienteId?: string; consultaId?: string };
};

export default async function TeleConsultaPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/medico/teleconsulta");

  // 1) Pegamos ids (pode vir da sua UI de seleção ou da querystring)
  const pacienteId = Number(searchParams?.pacienteId || 0);
  const consultaId = Number(searchParams?.consultaId || 0);

  // 2) Carrega a consulta para descobrir paciente + nome/cpf e validar médico dono
  let meta:
    | { medicoId: number; pacienteId: number; nome: string; cpf: string | null }
    | null = null;

  if (pacienteId && consultaId) {
    const c = await prisma.consulta.findFirst({
      where: { id: consultaId, pacienteId },
      select: {
        paciente: { select: { id: true, nome: true, cpf: true, medicoId: true } },
      },
    });
    if (c?.paciente) {
      meta = {
        medicoId: c.paciente.medicoId,
        pacienteId: c.paciente.id,
        nome: c.paciente.nome,
        cpf: c.paciente.cpf,
      };
    }
  }

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Tele-Consulta</h1>

      {!meta ? (
        <p className="text-sm">
          Selecione um paciente e uma consulta pela Anamnese e acesse esta página com:
          <br />
          <code className="bg-gray-100 px-2 py-1 rounded">
            /medico/teleconsulta?pacienteId=123&consultaId=456
          </code>
        </p>
      ) : (
        <Call
          medicoId={meta.medicoId}
          pacienteId={meta.pacienteId}
          nome={meta.nome}
          cpf={meta.cpf}
          consultaId={consultaId}
        />
      )}
    </main>
  );
}
