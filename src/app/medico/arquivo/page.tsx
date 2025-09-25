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
      <main className="p-6">
        <div className="mb-3">
          <a href="/medico" className="underline">
            &larr; Início
          </a>
        </div>
        <h1 className="text-xl font-semibold mb-2">Arquivos</h1>
        <p>Você precisa estar logado como médico.</p>
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

  const friendly = (c: { id: number; data: Date; pastaPath: string | null }) =>
    lastSegment(c.pastaPath) ??
    `${c.data.getFullYear()}${String(c.data.getMonth() + 1).padStart(
      2,
      "0"
    )}${String(c.data.getDate()).padStart(2, "0")}_${String(
      c.data.getHours()
    ).padStart(2, "0")}${String(c.data.getMinutes()).padStart(2, "0")}_${String(
      c.id
    ).padStart(6, "0")}`;

  const fullFolderPath =
    selected && selectedFolder ? `${base}/${selectedFolder}` : null;

  return (
    <main className="p-6">
      <div className="mb-3">
        <a href="/medico" className="underline">
          &larr; Início
        </a>
      </div>

      <h1 className="text-xl font-semibold mb-4">Arquivos</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Pacientes */}
        <div>
          <div className="font-medium mb-2">Pacientes</div>
          <div className="border rounded divide-y">
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
                  <div className="font-medium">{p.nome}</div>
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
        <div>
          <div className="font-medium mb-2">Consultas</div>
          <div className="border rounded divide-y min-h-[52px]">
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
                    {folder}
                  </Link>
                );
              })}
          </div>
        </div>

        {/* Arquivos (com toolbar + ações) */}
        <div>
          <div className="font-medium mb-2">Arquivos</div>

          {!selected && (
            <div className="border rounded px-3 py-2 text-sm text-gray-600">
              Selecione um paciente.
            </div>
          )}

          {selected && !selectedFolder && (
            <div className="border rounded px-3 py-2 text-sm text-gray-600">
              Selecione uma consulta.
            </div>
          )}

          {selected && selectedFolder && fullFolderPath && (
            <Explorer folderPath={fullFolderPath} files={arquivos} />
          )}
        </div>
      </div>
    </main>
  );
}
