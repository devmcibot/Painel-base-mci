import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Medico, Consulta, Paciente } from "@prisma/client";
import type { ReactNode } from "react";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Tipo customizado para a consulta com o nome do paciente incluído
type ConsultaComPaciente = Consulta & {
  paciente: Pick<Paciente, "nome">;
};

// Card de estatística com badge de ícone
function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number | string;
  icon: ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex items-center justify-center rounded-lg p-2 bg-[#EAF2FF] text-[#1E63F3]">
          {icon}
        </span>
        <p className="font-semibold text-gray-700">{title}</p>
      </div>
      <p className="text-3xl font-bold text-[#1E63F3] leading-none">{value}</p>
    </div>
  );
}

export default async function MedicoHome() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/medico");
  }

  const medico: Medico | null = await prisma.medico.findUnique({
    where: { id: Number((session.user as any)?.medicoId) },
  });

  if (!medico) {
    redirect("/login?error=unauthorized");
  }

  // Datas de referência
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);

  // Consultas / Pacientes / Próximas consultas em paralelo
  const [consultasHojeCount, totalPacientesCount, proximasConsultas] =
    await Promise.all([
      prisma.consulta.count({
        where: {
          medicoId: medico.id,
          status: "ABERTA",
          data: { gte: todayStart, lte: todayEnd },
        },
      }),
      prisma.paciente.count({
        where: { medicoId: medico.id },
      }),
      prisma.consulta.findMany({
        where: {
          medicoId: medico.id,
          status: "ABERTA",
          data: { gte: new Date(), lte: weekEnd },
        },
        take: 5,
        orderBy: { data: "asc" },
        include: {
          paciente: { select: { nome: true } },
        },
      }) as Promise<ConsultaComPaciente[]>,
    ]);

  return (
    <main className="min-h-screen bg-[#F7F9FC] p-8 md:p-10">
      {/* Cabeçalho */}
      <header className="mb-8">
        <h1 className="text-2xl md:text-3xl font-semibold text-[#1E63F3]">
          Olá, Dr(a). {session.user.name}!
        </h1>
        <p className="text-gray-500 mt-1">
          Aqui está um resumo da sua atividade e agenda.
        </p>
      </header>

      {/* Grid de estatísticas */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
        <StatCard title="Consultas Hoje" value={consultasHojeCount} icon={"💉"} />
        <StatCard title="Pacientes Totais" value={totalPacientesCount} icon={"👤"} />
        <StatCard
          title="Consultas Próximas (7d)"
          value={proximasConsultas.length}
          icon={"📅"}
        />
      </section>

      {/* Próximas Consultas */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-[#1E63F3]">
            Próximas Consultas
          </h2>
        </div>

        <div className="p-4 md:p-6">
          {proximasConsultas.length > 0 ? (
            <ul className="space-y-3">
              {proximasConsultas.map((consulta) => (
                <li
                  key={consulta.id}
                  className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition"
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
                    className="text-sm font-medium text-[#1E63F3] hover:underline"
                  >
                    Ver detalhes
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-center py-6">
              Nenhuma consulta agendada para os próximos 7 dias.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
