import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const medicoId = (session?.user as any)?.medicoId ?? null;
  if (!medicoId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pacientes = await prisma.paciente.findMany({
    where: { medicoId },
    orderBy: { id: "asc" },
    select: {
      id: true,
      nome: true,
      cpf: true,
      telefone: true,
      email: true,
      nascimento: true,
    },
  });

  // retorna o ARRAY (compatível com items.map)
  return NextResponse.json(pacientes, { status: 200 });
}
