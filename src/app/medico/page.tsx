import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Medico, Consulta, Paciente } from "@prisma/client";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma"; // Certifique-se que o caminho está correto

export const dynamic = "force-dynamic";

// Tipo customizado para a consulta com o nome do paciente incluído
type ConsultaComPaciente = Consulta & {
  paciente: Pick<Paciente, "nome">;
};

// Componente para os cards de estatísticas
const StatCard = ({
  title,
  value,
}: {
  title: string;
  value: number | string;
}) => (
  <div className="bg-white border rounded-lg p-6 shadow-sm">
    <p className="text-sm text-gray-500">{title}</p>
    <p className="text-3xl font-bold mt-1">{value}</p>
  </div>
);

export default async function MedicoHome() {
  const session = await getServerSession(authOptions);

  // A verificação original foi mantida e ajustada para checar o ID do usuário
  if (!session?.user) {
    redirect("/login?callbackUrl=/medico");
  }

  const medico: Medico | null = await prisma.medico.findUnique({
    where: { id: Number(session.user.medicoId) },
  });

  if (!medico) {
    // Caso o usuário não tenha um perfil de médico vinculado
    redirect("/login?error=unauthorized");
  }

  // 2. Definir períodos de data e buscar dados em paralelo
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [consultasHojeCount, totalPacientesCount, proximasConsultas] =
    await Promise.all([
      // Contar consultas de hoje
      prisma.consulta.count({
        where: {
          medicoId: medico.id,
          status: "ABERTA",
          data: { gte: todayStart, lte: todayEnd },
        },
      }),
      // Contar total de pacientes
      prisma.paciente.count({
        where: { medicoId: medico.id },
      }),
      // Buscar as 5 próximas consultas nos próximos 7 dias
      prisma.consulta.findMany({
        where: {
          medicoId: medico.id,
          status: "ABERTA",
          data: { gte: new Date(), lte: weekEnd },
        },
        take: 5,
        orderBy: { data: "asc" },
        include: {
          paciente: {
            select: { nome: true },
          },
        },
      }) as Promise<ConsultaComPaciente[]>,
    ]);

  // --- Fim da Lógica do Dashboard ---

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Cabeçalho de Boas-vindas */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800">
          Olá, Dr(a). {session.user.name}!
        </h1>
        <p className="text-gray-500 mt-1">
          Aqui está um resumo da sua atividade e agenda.
        </p>
      </div>

      {/* Grid de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Consultas Hoje" value={consultasHojeCount} />
        <StatCard title="Pacientes Totais" value={totalPacientesCount} />
        <StatCard
          title="Consultas Próximas (7d)"
          value={proximasConsultas.length}
        />
      </div>

      {/* Lista de Próximas Consultas */}
      <div className="bg-white border rounded-lg shadow-sm">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-700">
            Próximas Consultas
          </h2>
        </div>
        <div className="p-4">
          {proximasConsultas.length > 0 ? (
            <ul className="space-y-4">
              {proximasConsultas.map((consulta) => (
                <li
                  key={consulta.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-md hover:bg-gray-100"
                >
                  <div>
                    <p className="font-semibold text-gray-800">
                      {consulta.paciente.nome}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(consulta.data).toLocaleDateString("pt-BR", {
                        weekday: "long",
                        day: "2-digit",
                        month: "long",
                      })}{" "}
                      às{" "}
                      {new Date(consulta.data).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <Link
                    href={`/medico/consultas/${consulta.id}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Ver Detalhes
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-center py-4">
              Nenhuma consulta agendada para os próximos 7 dias.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
