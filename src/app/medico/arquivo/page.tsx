import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { listDir, patientFolderPath } from "@/lib/storage";
import Explorer from "./Explorer";

type SearchProps = { searchParams: Promise<{ p?: string; c?: string }> };
export const dynamic = "force-dynamic";

export default async function ArquivosPage({ searchParams }: SearchProps) {
  const sp = await searchParams;
  const session = await getServerSession(authOptions);
  const medicoId = (session?.user as any)?.medicoId as number | null;

  if (!medicoId) {
    return (
      <main className="min-h-screen bg-[#F7F9FC] p-8 md:p-10">
        <header className="mb-8">
          <h1 className="text-2xl md:text-3xl font-semibold text-[#1E63F3]">
            Arquivos
          </h1>
          <p className="text-gray-500 mt-1">
            Você precisa estar logado como médico.
          </p>
        </header>

        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <Link href="/login" className="text-[#1E63F3] hover:underline">
            Ir para login
          </Link>
        </section>
      </main>
    );
  }

  // pacientes do médico
  const pacientes = await prisma.paciente.findMany({
    where: { medicoId },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, cpf: true },
  });

  const pId = Number(sp.p) || null;
  const selected = pId ? pacientes.find((p) => p.id === pId) || null : null;

  // consultas do paciente (fonte confiável)
  const consultas = selected
    ? await prisma.consulta.findMany({
        where: { medicoId, pacienteId: selected.id },
        orderBy: { data: "desc" },
        select: { id: true, data: true, pastaPath: true },
      })
    : [];

  // pasta raiz do paciente no storage
  const base =
    selected &&
    patientFolderPath({
      medicoId,
      pacienteId: selected.id,
      nome: selected.nome,
      cpf: selected.cpf,
    });

  const selectedFolder = sp.c ?? "";

  // arquivos da consulta escolhida
  let arquivos: string[] = [];
  if (selected && selectedFolder) {
    const { files } = await listDir(`${base}/${selectedFolder}`);
    arquivos = files.filter((n) => n !== ".keep");
  }

  // helpers
  const lastSegment = (p?: string | null) => {
    if (!p) return null;
    const parts = p.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? null;
  };

  const friendly = (c: {
    id: number;
    data: Date;
    pastaPath: string | null;
  }) =>
    lastSegment(c.pastaPath) ??
    `${c.data.getFullYear()}${String(c.data.getMonth() + 1).padStart(
      2,
      "0"
    )}${String(c.data.getDate()).padStart(2, "0")}_${String(
      c.data.getHours()
    ).padStart(2, "0")}${String(c.data.getMinutes()).padStart(
      2,
      "0"
    )}_${String(c.id).padStart(6, "0")}`;

  // Formata label da consulta SEM usar a hora da pasta,
  // sempre baseado no campo "data" em America/Sao_Paulo
  const formatConsultaLabel = (data: Date) =>
    data.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });

  const fullFolderPath =
    selected && selectedFolder ? `${base}/${selectedFolder}` : null;

  return (
    <main className="min-h-screen bg-[#F7F9FC] p-8 md:p-10">
      <header className="mb-8">
        <h1 className="text-2xl md:text-3xl font-semibold text-[#1E63F3]">
          Arquivos
        </h1>
        <p className="text-gray-500 mt-1">
          Navegue por pacientes, consultas e documentos.
        </p>
      </header>

      {/* md: 4 colunas → Pacientes (1), Consultas (1), Arquivos (2) */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Pacientes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden md:col-span-1">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-[#1E63F3]">Pacientes</h2>
          </div>
          <div className="divide-y">
            {pacientes.map((p) => {
              const active = p.id === selected?.id;
              return (
                <Link
                  key={p.id}
                  href={`/medico/arquivo?p=${p.id}`}
                  className={`block px-3 py-2 hover:bg-gray-50 ${
                    active ? "bg-gray-100" : ""
                  }`}
                >
                  <div className="font-medium text-gray-800">{p.nome}</div>
                  <div className="text-xs text-gray-500">{p.cpf ?? "-"}</div>
                </Link>
              );
            })}
            {pacientes.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-600">
                Nenhum paciente.
              </div>
            )}
          </div>
        </div>

        {/* Consultas */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden md:col-span-1">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-[#1E63F3]">Consultas</h2>
          </div>
          <div className="divide-y min-h-[52px]">
            {!selected && (
              <div className="px-3 py-2 text-sm text-gray-600">
                Selecione um paciente.
              </div>
            )}

            {selected && consultas.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-600">
                Sem consultas para este paciente.
              </div>
            )}

            {selected &&
              consultas.map((c) => {
                const folder = lastSegment(c.pastaPath) ?? friendly(c);
                const active = selectedFolder === folder;
                return (
                  <Link
                    key={c.id}
                    href={`/medico/arquivo?p=${
                      selected.id
                    }&c=${encodeURIComponent(folder)}`}
                    className={`block px-3 py-2 hover:bg-gray-50 ${
                      active ? "bg-gray-100" : ""
                    }`}
                  >
                    {formatConsultaLabel(c.data)}
                  </Link>
                );
              })}
          </div>
        </div>

        {/* Arquivos */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden md:col-span-2">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-[#1E63F3]">Arquivos</h2>
          </div>

          <div className="p-3">
            {!selected && (
              <div className="rounded border border-gray-200 px-3 py-2 text-sm text-gray-600 bg-gray-50">
                Selecione um paciente.
              </div>
            )}

            {selected && !selectedFolder && (
              <div className="rounded border border-gray-200 px-3 py-2 text-sm text-gray-600 bg-gray-50">
                Selecione uma consulta.
              </div>
            )}

            {selected && selectedFolder && fullFolderPath && (
              <Explorer folderPath={fullFolderPath} files={arquivos} />
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
