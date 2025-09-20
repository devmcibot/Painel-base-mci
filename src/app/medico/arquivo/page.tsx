// src/app/medico/arquivos/page.tsx
import Topbar from "@/components/Topbar";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import Explorer from "./Explorer";

// evita cache no App Router (sempre pega a lista mais recente)
export const dynamic = "force-dynamic";

export default async function ArquivosPage() {
  const session = await getServerSession(authOptions);
  const medicoId = (session?.user as any)?.medicoId as number | null;

  if (!medicoId) {
    return (
      <>
        <div className="">
          <p className="">Este usuário não está vinculado a um médico.</p>
        </div>
      </>
    );
  }

  const pacientes = await prisma.paciente.findMany({
    where: { medicoId },
    select: {
      id: true,
      nome: true,
      cpf: true,
      consultas: {
        select: { id: true, data: true, pastaPath: true },
        orderBy: { data: "desc" },
      },
    },
    orderBy: { nome: "asc" },
  });

  // serializa datas para o client
  const data = pacientes.map((p) => ({
    ...p,
    consultas: p.consultas.map((c) => ({
      ...c,
      data: c.data.toISOString(),
    })),
  }));

  return (
    <>
      <div className="">
        <div className="mb-2">
          <Link href="/medico" className="underline">
            &larr; Voltar
          </Link>
        </div>

        <h1 className="text-xl font-semibold">Arquivos</h1>

        <Explorer pacientes={data} />
      </div>
    </>
  );
}
