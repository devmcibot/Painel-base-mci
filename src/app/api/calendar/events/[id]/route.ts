import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/src/lib/prisma";
import { isWithinAvailability, getBusy } from "@/src/lib/calendar";
import { rangesOverlap, toDate } from "@/src/lib/datetime";

export const dynamic = "force-dynamic";

type PutBody = {
  titulo?: string;
  pacienteId?: number; // quando presente, trocamos o paciente
  inicio?: string;     // ISO
  fim?: string;        // ISO
};

/* =======================
   DELETE /api/calendar/events/[id]
   - Deleta o evento
   - Se houver consulta vinculada, marca como CANCELADA
   ======================= */
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

    const id = Number(params.id);

    const evt = await prisma.agendaEvento.findFirst({
      where: { id, medicoId },
      select: { id: true, consultaId: true },
    });
    if (!evt) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.agendaEvento.delete({ where: { id } });
      if (evt.consultaId) {
        await tx.consulta.update({
          where: { id: evt.consultaId },
          data: { status: "CANCELADA" },
        });
      }
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("[events.id][DELETE]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

/* =======================
   PUT /api/calendar/events/[id]
   - Valida disponibilidade/conflito
   - Atualiza evento
   - Propaga para Consulta (data e, se enviado, paciente)
   ======================= */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const medicoId = (session?.user as any)?.medicoId as number | undefined;
    if (!session || !medicoId) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const id = Number(params.id);
    const body = (await req.json()) as PutBody;

    const evt = await prisma.agendaEvento.findFirst({
      where: { id, medicoId },
      select: {
        id: true,
        pacienteId: true, // pode ser null aqui
        inicio: true,
        fim: true,
        consultaId: true,
      },
    });
    if (!evt) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const changedPaciente = typeof body.pacienteId === "number";
    const changedHorario = !!(body.inicio || body.fim);

    const nextInicio = body.inicio ? toDate(body.inicio) : evt.inicio;
    const nextFim = body.fim ? toDate(body.fim) : evt.fim;

    // valida paciente somente se foi solicitado trocar
    if (changedPaciente) {
      const p = await prisma.paciente.findFirst({
        where: { id: body.pacienteId!, medicoId },
        select: { id: true },
      });
      if (!p) {
        return NextResponse.json(
          { error: "PACIENTE_NAO_PERTENCE_AO_MEDICO" },
          { status: 400 }
        );
      }
    }

    // valida horários somente se mudou horário
    if (changedHorario) {
      if (!(nextInicio < nextFim)) {
        return NextResponse.json({ error: "HORARIO_INVALIDO" }, { status: 400 });
      }

      const avail = await isWithinAvailability(medicoId, nextInicio, nextFim);
      if (!avail.ok) {
        return NextResponse.json(
          { error: "CONFLICT", reasons: [avail.reason] },
          { status: 409 }
        );
      }

      const busy = await getBusy(medicoId, nextInicio, nextFim);
      const overlapOther = busy.some(
        (b) =>
          rangesOverlap(nextInicio, nextFim, b.inicio, b.fim) &&
          !(b.origem === "evento" && b.refId === id)
      );
      if (overlapOther) {
        return NextResponse.json(
          { error: "CONFLICT", reasons: ["overlap_busy"] },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      // monta 'data' do evento apenas com chaves que realmente mudaram
      const evtData: any = {};
      if (typeof body.titulo === "string" && body.titulo.trim()) {
        evtData.titulo = body.titulo.trim();
      }
      if (changedHorario) {
        evtData.inicio = nextInicio;
        evtData.fim = nextFim;
      }
      if (changedPaciente) {
        // evento aceita null, mas só aplicamos quando pedirem mudança
        evtData.pacienteId = body.pacienteId!;
      }

      const evento = await tx.agendaEvento.update({
        where: { id },
        data: evtData,
        select: {
          id: true,
          titulo: true,
          inicio: true,
          fim: true,
          pacienteId: true,
          consultaId: true,
        },
      });

      // Propaga somente o que faz sentido para Consulta:
      // - data (se mudou horário)
      // - pacienteId (se pediram para trocar) — Consulta NÃO aceita null.
      if (evento.consultaId) {
        const consultaData: any = {};
        if (changedHorario) {
          consultaData.data = nextInicio;
        }
        if (changedPaciente) {
          consultaData.pacienteId = body.pacienteId!; // aqui é sempre number
        }
        if (Object.keys(consultaData).length > 0) {
          await tx.consulta.update({
            where: { id: evento.consultaId },
            data: consultaData,
          });
        }
      }

      return evento;
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    console.error("[events.id][PUT]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
