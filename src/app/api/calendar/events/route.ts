import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/src/lib/prisma";
import { isWithinAvailability, getBusy } from "@/src/lib/calendar";
import { rangesOverlap, toDate } from "@/src/lib/datetime";

export const dynamic = "force-dynamic";

type PostBody = {
  medicoId: number;
  pacienteId: number;
  titulo: string;
  inicio: string; // ISO
  fim: string;    // ISO
  origem?: string;
};

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const medicoId = (session?.user as any)?.medicoId as number | undefined;
    if (!session || !medicoId) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = (await req.json()) as PostBody;

    // segurança: médico só cria para si
    if (body.medicoId !== medicoId) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const inicio = toDate(body.inicio);
    const fim = toDate(body.fim);
    if (!(inicio < fim)) {
      return NextResponse.json({ error: "HORARIO_INVALIDO" }, { status: 400 });
    }

    // paciente pertence ao médico?
    const paciente = await prisma.paciente.findFirst({
      where: { id: body.pacienteId, medicoId },
      select: { id: true },
    });
    if (!paciente) {
      return NextResponse.json({ error: "PACIENTE_INVALIDO" }, { status: 400 });
    }

    // disponibilidade (horário do médico)
    const avail = await isWithinAvailability(medicoId, inicio, fim);
    if (!avail.ok) {
      return NextResponse.json(
        { conflict: true, reasons: [avail.reason] },
        { status: 409 }
      );
    }

    // conflitos com eventos/ausências existentes
    const busy = await getBusy(medicoId, inicio, fim);
    const overlap = busy.some(b => rangesOverlap(inicio, fim, b.inicio, b.fim));
    if (overlap) {
      return NextResponse.json(
        {
          conflict: true,
          reasons: ["overlap_busy"],
          busy: busy.map(b => ({
            inicio: b.inicio.toISOString(),
            fim: b.fim.toISOString(),
            origem: b.origem,
            refId: b.refId
          })),
        },
        { status: 409 }
      );
    }

    // cria Consulta + Evento em transação
    const created = await prisma.$transaction(async (tx) => {
      const consulta = await tx.consulta.create({
        data: {
          medicoId,
          pacienteId: body.pacienteId,
          data: inicio,
          status: "ABERTA",
        },
        select: { id: true },
      });

      const evento = await tx.agendaEvento.create({
        data: {
          medicoId,
          pacienteId: body.pacienteId,
          consultaId: consulta.id,
          titulo: body.titulo,
          inicio,
          fim,
          origem: body.origem ?? "manual",
        },
        select: { id: true, consultaId: true },
      });

      return { evento, consulta };
    });

    return NextResponse.json(
      { id: created.evento.id, consultaId: created.evento.consultaId },
      { status: 201 }
    );
  } catch (e) {
    console.error("[events][POST]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
