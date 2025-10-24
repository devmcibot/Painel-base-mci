import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import ConsultasTableClient from "./ConsultasTableClient";

export default async function ConsultasPage() {
  const session = await getServerSession(authOptions);
  const medicoId = (session?.user as any)?.medicoId ?? null;

  const consultas = await prisma.consulta.findMany({
    where: medicoId ? { medicoId } : undefined,
    orderBy: { data: "desc" },
    select: {
      id: true,
      data: true,
      status: true,
      paciente: { select: { nome: true } },
    },
  });

  return (
    <main className="min-h-screen bg-[#F7F9FC] p-8 md:p-10">
      {/* Cabeçalho */}
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-[#1E63F3]">
            Consultas
          </h1>
          <p className="text-gray-500 mt-1">Gerencie suas consultas.</p>
        </div>
        <Link
          href="/medico/consultas/novo"
          className="px-4 py-2 rounded-lg bg-[#1E63F3] text-white hover:bg-[#0F4CCF]"
        >
          Nova consulta
        </Link>
      </header>

      {/* Tabela / lista */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden p-4 md:p-6">
        <ConsultasTableClient
          initialItems={consultas.map((c) => ({
            id: c.id,
            data: c.data.toISOString(),
            status: c.status,
            paciente: c.paciente?.nome ?? "-",
          }))}
        />
      </section>
    </main>
  );
}
