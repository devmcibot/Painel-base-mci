// src/app/api/medico/consultas/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { ensureConsultaFolder } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Lista SOMENTE as consultas do médico logado
export async function GET() {
  const session = await getServerSession(authOptions);
  const medicoId = (session?.user as any)?.medicoId ?? null;
  if (!medicoId) {
    return NextResponse.json({ error: "Sem médico vinculado" }, { status: 401 });
  }

  const consultas = await prisma.consulta.findMany({
    where: { medicoId },
    orderBy: { data: "desc" },
    include: { paciente: true },
  });

  return NextResponse.json(consultas);
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const medicoId = (session?.user as any)?.medicoId ?? null;
    if (!medicoId) {
      return NextResponse.json({ error: "Sem médico vinculado" }, { status: 401 });
    }

    const { pacienteId, data } = await req.json();
    if (!pacienteId || !data) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    // 1) cria a consulta e já traz dados do paciente para montar o caminho
    const criada = await prisma.consulta.create({
      data: {
        medicoId,
        pacienteId: Number(pacienteId),
        data: new Date(data), // ISO -> Date
        // status usa o default "ABERTA"
      },
      include: {
        paciente: { select: { id: true, nome: true, cpf: true } },
      },
    });

    // 2) cria a subpasta no Storage (bucket privado)
    const folder = await ensureConsultaFolder({
      medicoId,
      pacienteId: criada.paciente.id,
      nome: criada.paciente.nome,
      cpf: criada.paciente.cpf,
      consultaId: criada.id,
      data: criada.data,
    });

    // 3) indexa o caminho na tabela (recomendado)
    await prisma.consulta.update({
      where: { id: criada.id },
      data: { pastaPath: folder },
    });

    return NextResponse.json({ id: criada.id, pastaPath: folder }, { status: 201 });
  } catch (e) {
    console.error("POST /api/medico/consultas error:", e);
    return NextResponse.json({ error: "Falha ao criar consulta" }, { status: 500 });
  }
}
