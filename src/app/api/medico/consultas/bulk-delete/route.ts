// src/app/api/medico/consultas/bulk-delete/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/medico/consultas/bulk-delete
 * body: { ids: number[] }
 * - Apaga somente consultas do médico autenticado.
 * - Remove (se houver) eventos de agenda vinculados às consultas.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const medicoId = (session?.user as any)?.medicoId as number | undefined;
    if (!session || !medicoId) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = (await req.json()) as { ids: unknown };
    const ids = Array.isArray(body.ids) ? body.ids.map((v) => Number(v)).filter((n) => Number.isFinite(n)) : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // garante que são consultas do médico
      const owned = await tx.consulta.findMany({
        where: { id: { in: ids }, medicoId },
        select: { id: true },
      });
      const ownedIds = owned.map((c) => c.id);
      if (ownedIds.length === 0) return { deleted: 0, removedEvents: 0 };

      // remove eventos de agenda vinculados a essas consultas
      const rmEvents = await tx.agendaEvento.deleteMany({
        where: { medicoId, consultaId: { in: ownedIds } },
      });

      // apaga consultas
      const del = await tx.consulta.deleteMany({
        where: { id: { in: ownedIds }, medicoId },
      });

      return { deleted: del.count, removedEvents: rmEvents.count };
    });

    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    console.error("[consultas.bulk-delete][POST]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
