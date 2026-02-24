import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { addMinutes, rangesOverlap } from "@/lib/datetime";
import { isWithinAvailability, getBusy } from "@/lib/calendar";
import { ensureConsultaFolder } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Status = "ABERTA" | "CONCLUIDA" | "CANCELADA" | "FALTOU" | "REMARCADA";

type PatchBody = {
  data?: string;
  status?: Status;
  pastaPath?: string | null;
  preAnamnesePath?: string | null;
  audioPath?: string | null;
  anamnesePath?: string | null;
  relatorioPath?: string | null;
};

type Ctx = { params: Promise<{ id: string }> };

async function requireMedico() {
  const session = await getServerSession(authOptions);
  const medicoId = (session?.user as { medicoId?: number } | null)?.medicoId;

  if (!session || !medicoId) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }),
    };
  }

  return { ok: true as const, session, medicoId };
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireMedico();
    if (!auth.ok) return auth.res;

    const { id: idStr } = await ctx.params;
    const id = Number(idStr);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const c = await prisma.consulta.findFirst({
      where: { id, medicoId: auth.medicoId },
      include: { paciente: true },
    });
    if (!c) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    return NextResponse.json(c);
  } catch (e) {
    console.error("[consultas.id][GET]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireMedico();
    if (!auth.ok) return auth.res;

    const { id: idStr } = await ctx.params;
    const id = Number(idStr);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const body = (await req.json()) as PatchBody;

    const current = await prisma.consulta.findFirst({
      where: { id, medicoId: auth.medicoId },
      select: { id: true, data: true, pacienteId: true, pastaPath: true },
    });
    if (!current) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const nextStart = body.data ? new Date(body.data) : current.data;
    const nextEnd = addMinutes(nextStart, 30);

    const avail = await isWithinAvailability(auth.medicoId, nextStart, nextEnd);
    if (!avail.ok) {
      return NextResponse.json(
        { error: "CONFLICT", reasons: [avail.reason] },
        { status: 409 }
      );
    }

    const busy = await getBusy(auth.medicoId, nextStart, nextEnd);
    const ownEvent = await prisma.agendaEvento.findFirst({
      where: { consultaId: id },
      select: { id: true },
    });

    const hasClash = busy.some((b) => {
      const bi = new Date(b.inicio);
      const bf = new Date(b.fim);
      const overlaps = rangesOverlap(nextStart, nextEnd, bi, bf);
      const isSelf =
        b.origem === "evento" &&
        typeof b.refId === "number" &&
        b.refId === ownEvent?.id;

      return overlaps && !isSelf;
    });

    if (hasClash) {
      return NextResponse.json(
        { error: "CONFLICT", reasons: ["overlap_busy"] },
        { status: 409 }
      );
    }

    const dataUpdate: Partial<{
      status: Status;
      data: Date;
      pastaPath: string | null;
      preAnamnesePath: string | null;
      audioPath: string | null;
      anamnesePath: string | null;
      relatorioPath: string | null;
    }> = {};

    if (body.status) dataUpdate.status = body.status;
    if (body.data) dataUpdate.data = nextStart;

    const fileKeys: Array<
      "pastaPath" | "preAnamnesePath" | "audioPath" | "anamnesePath" | "relatorioPath"
    > = ["pastaPath", "preAnamnesePath", "audioPath", "anamnesePath", "relatorioPath"];

    for (const k of fileKeys) {
      if (k in body) {
        dataUpdate[k] = body[k] ?? null;
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const up = await tx.consulta.update({ where: { id }, data: dataUpdate });

      const ev = await tx.agendaEvento.findFirst({ where: { consultaId: id } });
      const pac = await tx.paciente.findUnique({
        where: { id: current.pacienteId },
        select: { nome: true },
      });

      const titulo = `Consulta — ${pac?.nome ?? "Paciente"}`;

      if (ev) {
        await tx.agendaEvento.update({
          where: { id: ev.id },
          data: { titulo, inicio: nextStart, fim: nextEnd },
        });
      } else {
        await tx.agendaEvento.create({
          data: {
            medicoId: auth.medicoId,
            pacienteId: current.pacienteId,
            consultaId: id,
            titulo,
            inicio: nextStart,
            fim: nextEnd,
            origem: "manual",
          },
        });
      }

      return up;
    });

    if (!current.pastaPath) {
      const pac = await prisma.paciente.findUnique({
        where: { id: current.pacienteId },
        select: { nome: true, cpf: true },
      });

      const folder = await ensureConsultaFolder({
        medicoId: auth.medicoId,
        pacienteId: current.pacienteId,
        nome: pac?.nome ?? "paciente",
        cpf: pac?.cpf ?? null,
        consultaId: id,
        data: nextStart,
      });

      console.log("[consultas.id][PATCH] pasta criada:", folder);
      await prisma.consulta.update({ where: { id }, data: { pastaPath: folder } });
    }

    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    console.error("[consultas.id][PATCH]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireMedico();
    if (!auth.ok) return auth.res;

    const { id: idStr } = await ctx.params;
    const id = Number(idStr);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const c = await prisma.consulta.findFirst({
      where: { id, medicoId: auth.medicoId },
    });
    if (!c) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      const ev = await tx.agendaEvento.findFirst({ where: { consultaId: id } });
      if (ev) await tx.agendaEvento.delete({ where: { id: ev.id } });

      await tx.consulta.delete({ where: { id } });
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("[consultas.id][DELETE]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}