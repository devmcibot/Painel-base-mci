import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const dynamic = "force-dynamic";

export async function GET() {
  const consultas = await prisma.consulta.findMany({
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

    const nova = await prisma.consulta.create({
      data: {
        medicoId,
        pacienteId: Number(pacienteId),
        data: new Date(data),
      },
    });

    return NextResponse.json(nova, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao criar consulta" }, { status: 500 });
  }
}
