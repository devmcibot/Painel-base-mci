// src/app/api/calendar/events/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { toDate } from "@/lib/datetime";
import { isWithinAvailability, getBusy } from "@/lib/calendar";
import { rangesOverlap } from "@/lib/datetime";
import { ensureConsultaFolder } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  pacienteId: number;
  titulo?: string;
  inicio: string; // ISO
  fim: string;    // ISO
  origem?: "manual" | "whatsapp" | "n8n";
};

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const medicoId = (session?.user as any)?.medicoId as number | undefined;
    if (!session || !medicoId) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = (await req.json()) as Body;
    const pacienteId = Number(body.pacienteId);
    const inicio = toDate(body.inicio);
    const fim = toDate(body.fim);
    const origem = body.origem ?? "manual";

    if (!pacienteId || !(inicio < fim)) {
      return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
    }

    // 1) valida disponibilidade
    const avail = await isWithinAvailability(medicoId, inicio, fim);
    if (!avail.ok) {
      return NextResponse.json({ conflict: true, reasons: [avail.reason] }, { status: 409 });
    }

    // 2) conflito com outros eventos/ausências
    const busy = await getBusy(medicoId, inicio, fim);
    const hasClash = busy.some(b => rangesOverlap(inicio, fim, toDate(b.inicio), toDate(b.fim)));
    if (hasClash) {
      return NextResponse.json({ conflict: true, reasons: ["overlap_busy"] }, { status: 409 });
    }

    // 3) valida paciente pertence ao médico
    const paciente = await prisma.paciente.findFirst({
      where: { id: pacienteId, medicoId },
      select: { id: true, nome: true, cpf: true },
    });
    if (!paciente) {
      return NextResponse.json({ error: "PACIENTE_NAO_ENCONTRADO" }, { status: 404 });
    }

    // 4) cria consulta + evento
    const { consultaId, eventoId } = await prisma.$transaction(async (tx) => {
      const c = await tx.consulta.create({
        data: { medicoId, pacienteId, data: inicio, status: "ABERTA" },
        select: { id: true },
      });

      const ev = await tx.agendaEvento.create({
        data: {
          medicoId,
          pacienteId,
          consultaId: c.id,
          titulo: body.titulo?.trim() || `Consulta — ${paciente.nome}`,
          inicio,
          fim,
          origem,
        },
        select: { id: true },
      });

      return { consultaId: c.id, eventoId: ev.id };
    });

    // 5) materializa subpasta no bucket e salva caminho na consulta
    const folder = await ensureConsultaFolder({
      medicoId,
      pacienteId,
      nome: paciente.nome,
      cpf: paciente.cpf ?? null,
      consultaId,
      data: inicio,
    });
    console.log("[calendar.events][POST] pasta da consulta:", folder);

    await prisma.consulta.update({
      where: { id: consultaId },
      data: { pastaPath: folder },
    });

    return NextResponse.json({ id: eventoId, consultaId, pastaPath: folder }, { status: 201 });
  } catch (e) {
    console.error("[calendar.events][POST] error:", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
