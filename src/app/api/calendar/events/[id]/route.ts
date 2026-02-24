import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { rmRecursive } from "@/lib/storage";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    const medicoId = (session?.user as { medicoId?: number } | null)?.medicoId;

    if (!session || !medicoId) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { id: idStr } = await ctx.params;
    const eventId = Number(idStr);
    if (!Number.isFinite(eventId) || eventId <= 0) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const ev = await prisma.agendaEvento.findFirst({
      where: { id: eventId, medicoId },
      select: { id: true, consultaId: true },
    });
    if (!ev) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const consulta = ev.consultaId
      ? await prisma.consulta.findFirst({
          where: { id: ev.consultaId, medicoId },
          select: { id: true, pastaPath: true },
        })
      : null;

    if (consulta?.pastaPath) {
      try {
        await rmRecursive(consulta.pastaPath);
      } catch (e) {
        console.warn("[storage][rmRecursive] falhou:", e);
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.agendaEvento.delete({ where: { id: eventId } });
      if (consulta?.id) {
        await tx.consulta.delete({ where: { id: consulta.id } });
      }
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("[calendar/events/:id][DELETE]", e);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}