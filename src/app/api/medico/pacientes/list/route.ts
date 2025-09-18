import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/src/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const medicoId = (session?.user as any)?.medicoId as number | undefined;

    if (!session || !medicoId) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const pacientes = await prisma.paciente.findMany({
      where: { medicoId },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    });

    return NextResponse.json({ pacientes }, { status: 200 });
  } catch (e) {
    console.error("[pacientes.list][GET]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
