// src/app/api/calendar/events/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { rmRecursive } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const medicoId = (session?.user as any)?.medicoId as number | undefined;
    if (!session || !medicoId) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const eventId = Number(params.id);

    // pega o evento e a consulta vinculada
    const ev = await prisma.agendaEvento.findFirst({
      where: { id: eventId, medicoId },
      select: { id: true, consultaId: true },
    });
    if (!ev) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    // pega a consulta com o caminho da pasta
    const consulta = ev.consultaId
      ? await prisma.consulta.findFirst({
          where: { id: ev.consultaId, medicoId },
          select: { id: true, pastaPath: true },
        })
      : null;

    // apaga pasta no bucket (se existir)
    if (consulta?.pastaPath) {
      try {
        await rmRecursive(consulta.pastaPath);
      } catch (e) {
        // não falhar a deleção lógica se storage der 404 etc.
        console.warn("[storage][rmRecursive] falhou:", e);
      }
    }

    // apaga DB em transação: evento -> consulta
    await prisma.$transaction(async (tx) => {
      await tx.agendaEvento.delete({ where: { id: eventId } });
      if (consulta?.id) {
        await tx.consulta.delete({ where: { id: consulta.id } });
      }
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("[calendar/events/:id][DELETE]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
