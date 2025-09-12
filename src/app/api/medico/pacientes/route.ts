import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const dynamic = "force-dynamic";

// Lista pacientes do médico logado (ou por query medicoId)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const medicoIdParam = searchParams.get("medicoId");
  let medicoId: number | null = medicoIdParam ? Number(medicoIdParam) : null;

  if (!medicoId) {
    const session = await getServerSession(authOptions);
    medicoId = (session?.user as any)?.medicoId ?? null;
  }
  if (!medicoId) {
    return NextResponse.json({ error: "Sem médico vinculado" }, { status: 401 });
  }

  const items = await prisma.paciente.findMany({
    where: { medicoId },
    orderBy: { id: "asc" },
    select: {
      id: true,
      nome: true,
      cpf: true,
      email: true,
      telefone: true,
      nascimento: true, // <= IMPORTANTE
    },
  });

  return NextResponse.json(items);
}

// Cria paciente
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const medicoId = (session?.user as any)?.medicoId ?? null;
  if (!medicoId) {
    return NextResponse.json({ error: "Sem médico vinculado" }, { status: 401 });
  }

  const body = await req.json();
  const { nome, cpf, email, telefone, nascimento } = body as {
    nome: string;
    cpf: string;
    email?: string | null;
    telefone?: string | null;
    nascimento?: string | null; // formato "yyyy-mm-dd"
  };

  if (!nome || !cpf) {
    return NextResponse.json({ error: "Nome e CPF são obrigatórios" }, { status: 400 });
  }

  // Converte "yyyy-mm-dd" para Date (evita timezone mudando o dia)
  const nascDate =
    nascimento && nascimento.trim()
      ? new Date(`${nascimento}T12:00:00`) // meio-dia local evita “voltar 1 dia”
      : null;

  const novo = await prisma.paciente.create({
    data: {
      medicoId,
      nome,
      cpf,
      email: email?.trim() || null,
      telefone: telefone?.trim() || null,
      nascimento: nascDate, // <= SALVANDO
    },
    select: { id: true },
  });

  return NextResponse.json(novo, { status: 201 });
}
