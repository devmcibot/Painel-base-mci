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
    <div>
      <div className="mb-2">
        <Link href="/medico" className="underline">
          &larr; Início
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Consultas</h1>
        <Link
          href="/medico/consultas/novo"
          className="px-3 py-2 rounded bg-blue-primary text-white"
        >
          Nova consulta
        </Link>
      </div>

      <ConsultasTableClient
        initialItems={consultas.map((c) => ({
          id: c.id,
          data: c.data.toISOString(),
          status: c.status,
          paciente: c.paciente?.nome ?? "-",
        }))}
      />
    </div>
  );
}
