import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Editor from "./Editor";
import { formatInTimeZone } from "date-fns-tz";

function StatusBadge({ status }: { status: string }) {
  const s = status?.toUpperCase?.() ?? "";
  const styles =
    s === "ABERTA"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : s === "CONCLUIDA" || s === "CONCLUÍDA"
      ? "bg-gray-50 text-gray-700 border-gray-200"
      : s === "CANCELADA"
      ? "bg-rose-50 text-rose-700 border-rose-200"
      : "bg-indigo-50 text-indigo-700 border-indigo-200";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border ${styles}`}
    >
      {status}
    </span>
  );
}

export default async function ConsultaPage({
  params,
}: {
  params: { id: string };
}) {
  const id = Number(params.id);
  if (!id || Number.isNaN(id)) return notFound();

  const c = await prisma.consulta.findUnique({
    where: { id },
    include: { paciente: true },
  });
  if (!c) return notFound();

  // Sempre mostrar no fuso do Brasil (America/Sao_Paulo)
  const tz = "America/Sao_Paulo";

  // label só para exibição
  const dataLabel = formatInTimeZone(
    c.data,
    tz,
    "dd/MM/yyyy, HH:mm"
  );

  // valor para o <input type="datetime-local">
  const dtLocal = formatInTimeZone(
    c.data,
    tz,
    "yyyy-MM-dd'T'HH:mm"
  );

  return (
    <main className="min-h-screen bg-[#F7F9FC] p-8 md:p-10 space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-[#1E63F3]">
            Consulta #{c.id}
          </h1>
          <p className="text-gray-500 mt-1">
            Gerencie os dados e o status desta consulta.
          </p>
        </div>

        <Link
          href="/medico/consultas"
          className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          &larr; Voltar para a lista
        </Link>
      </header>

      {/* Card principal */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden max-w-3xl">
        <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
          <div className="text-gray-800">
            <div className="font-medium">
              Paciente:{" "}
              <span className="font-semibold">
                {c.paciente?.nome ?? "-"}
              </span>
            </div>
            {/* data/hora atual em horário local do médico */}
            <div className="text-sm text-gray-500">
              Data atual da consulta: {dataLabel}
            </div>
          </div>

          <StatusBadge status={String(c.status)} />
        </div>

        <div className="p-4 md:p-6">
          {/* Editor recebe o datetime local já correto */}
          <Editor
            id={c.id}
            defaultDate={dtLocal}
            defaultStatus={c.status as any}
          />
        </div>
      </section>
    </main>
  );
}
