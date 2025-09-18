import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/src/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const medicoId = (session?.user as any)?.medicoId as number | undefined;
    if (!session || !medicoId) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const days = Number(searchParams.get("days") ?? 14);

    const now = new Date();
    const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const eventos = await prisma.agendaEvento.findMany({
      where: { medicoId, inicio: { gte: now }, fim: { lte: until } },
      select: {
        id: true,
        titulo: true,
        inicio: true,
        fim: true,
        paciente: { select: { id: true, nome: true } },
      },
      orderBy: { inicio: "asc" },
    });

    return NextResponse.json({ eventos }, { status: 200 });
  } catch (e) {
    console.error("[events.upcoming][GET]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
