import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import PacienteFormEdit from "./PacienteFormEdit";

export default async function EditarPacientePage({
  params,
}: { params: { id: string } }) {
  // valida sessão e médico
  const session = await getServerSession(authOptions);
  const medicoId = (session?.user as any)?.medicoId ?? null;
  if (!medicoId) return notFound();

  const id = Number(params.id);
  if (!id) return notFound();

  // busca o paciente do médico logado
  const p = await prisma.paciente.findFirst({
    where: { id, medicoId },
    select: { id: true, nome: true, cpf: true, email: true, telefone: true, nascimento: true },
  });
  if (!p) return notFound();

  // prepara string para <input type="date">
  const nascStr = p.nascimento ? p.nascimento.toISOString().slice(0, 10) : "";

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <Link href="/medico/pacientes" className="underline">&larr; Início</Link>
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
