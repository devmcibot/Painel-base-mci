import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

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
    <main className="p-6 space-y-4">
      <div className="mb-2">
        <Link href="/medico" className="underline">&larr; Voltar</Link>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Consultas</h1>
        <Link href="/medico/consultas/novo" className="px-3 py-2 rounded bg-blue-600 text-white">
          Nova consulta
        </Link>
      </div>

      <div className="border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left">Data/Hora</th>
              <th className="p-3 text-left">Paciente</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Ações</th>
            </tr>
          </thead>
          <tbody>
            {consultas.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-3">{new Date(c.data).toLocaleString()}</td>
                <td className="p-3">{c.paciente?.nome ?? "-"}</td>
                <td className="p-3">{c.status}</td>
                <td className="p-3">
                  <Link href={`/medico/consultas/${c.id}`} className="text-blue-700 underline">abrir</Link>
                </td>
              </tr>
            ))}
            {consultas.length === 0 && (
              <tr><td className="p-3" colSpan={4}>Nenhuma consulta ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
