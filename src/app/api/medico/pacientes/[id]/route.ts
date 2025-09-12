import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const dynamic = "force-dynamic";

// Detalhe do paciente (garantindo que pertence ao médico logado)
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const medicoId = (session?.user as any)?.medicoId ?? null;
  if (!medicoId) return NextResponse.json({ error: "Sem médico vinculado" }, { status: 401 });

  const id = Number(params.id);
  if (!id) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const pac = await prisma.paciente.findFirst({
    where: { id, medicoId },
    select: { id: true, nome: true, cpf: true, email: true, telefone: true, nascimento: true },
  });

  if (!pac) return NextResponse.json({ error: "Paciente não encontrado" }, { status: 404 });
  return NextResponse.json(pac);
}

// Editar paciente
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const medicoId = (session?.user as any)?.medicoId ?? null;
  if (!medicoId) return NextResponse.json({ error: "Sem médico vinculado" }, { status: 401 });

  const id = Number(params.id);
  if (!id) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const exists = await prisma.paciente.findFirst({ where: { id, medicoId }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Paciente não encontrado" }, { status: 404 });

  const body = await req.json();
  const { nome, cpf, email, telefone, nascimento } = body as {
    nome?: string;
    cpf?: string;
    email?: string | null;
    telefone?: string | null;
    nascimento?: string | null; // "yyyy-mm-dd" ou null
  };

  const data: any = {};
  if (nome !== undefined) data.nome = String(nome);
  if (cpf !== undefined) data.cpf = String(cpf);
  if (email !== undefined) data.email = email?.trim() || null;
  if (telefone !== undefined) data.telefone = telefone?.trim() || null;
  if (nascimento !== undefined) {
    data.nascimento = nascimento ? new Date(`${nascimento}T12:00:00`) : null;
  }

  try {
    await prisma.paciente.update({ where: { id }, data });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    // CPF duplicado, etc.
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "CPF já cadastrado." }, { status: 409 });
    }
    console.error("PATCH paciente error:", e);
    return NextResponse.json({ error: "Erro ao atualizar." }, { status: 500 });
  }
}
