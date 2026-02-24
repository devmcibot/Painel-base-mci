import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import PacienteFormEdit from "./PacienteFormEdit";

function toDateInputValue(date: Date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  // en-CA => YYYY-MM-DD
  return fmt.format(date);
}

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditarPacientePage({ params }: PageProps) {
  const { id: idStr } = await params;

  const session = await getServerSession(authOptions);
  const medicoId = (session?.user as { medicoId?: number } | null)?.medicoId ?? null;
  if (!medicoId) return notFound();

  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) return notFound();

  const p = await prisma.paciente.findFirst({
    where: { id, medicoId },
    select: {
      id: true,
      nome: true,
      cpf: true,
      email: true,
      telefone: true,
      nascimento: true,
    },
  });
  if (!p) return notFound();

  const nascStr = p.nascimento ? toDateInputValue(p.nascimento) : "";

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <Link href="/medico/pacientes" className="underline">
          &larr; Início
        </Link>
      </div>

      <h1 className="text-xl font-semibold">Editar paciente #{p.id}</h1>

      <PacienteFormEdit
        id={p.id}
        initial={{
          nome: p.nome,
          cpf: p.cpf,
          email: p.email ?? "",
          telefone: p.telefone ?? "",
          nascimento: nascStr,
        }}
      />
    </main>
  );
}