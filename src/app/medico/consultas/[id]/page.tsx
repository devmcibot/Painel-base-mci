import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Editor from "./Editor";

export default async function ConsultaPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!id || Number.isNaN(id)) return notFound();

  const c = await prisma.consulta.findUnique({
    where: { id },
    include: { paciente: true },
  });
  if (!c) return notFound();

  const dtLocal = new Date(c.data).toISOString().slice(0, 16);

  return (
    <main className="p-6 space-y-4">
      <div>
        <Link href="/medico/consultas" className="underline">
          &larr; Voltar
        </Link>
      </div>

      <h1 className="text-2xl font-semibold">Consulta #{c.id}</h1>

      <div className="border rounded p-4 space-y-3 max-w-xl">
        <div>
          <b>Paciente:</b> {c.paciente?.nome ?? "-"}
        </div>

        <Editor id={c.id} defaultDate={dtLocal} defaultStatus={c.status as any} />
      </div>
    </main>
  );
}
