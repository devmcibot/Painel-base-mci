// src/app/api/medico/consultas/novo/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { fromLocalInputToUTC, toDate } from "@/lib/datetime";
import { ensureEventForConsulta } from "@/lib/agenda-sync";
import { ensureConsultaFolder } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // 👈 obrigatório pro Uint8Array/Buffer

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const medicoId = (session?.user as any)?.medicoId as number | undefined;
    if (!session || !medicoId) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await req.json();
    const pacienteId: number = Number(body.pacienteId);
    if (!pacienteId) {
      return NextResponse.json({ error: "PACIENTE_OBRIGATORIO" }, { status: 400 });
    }

    const data: Date =
      typeof body.data === "string" && body.data.includes("T")
        ? fromLocalInputToUTC(body.data)
        : toDate(body.data);

    const created = await prisma.consulta.create({
      data: { medicoId, pacienteId, data, status: "ABERTA" },
      select: { id: true, pacienteId: true, data: true },
    });

    const paciente = await prisma.paciente.findUnique({
      where: { id: pacienteId },
      select: { nome: true, cpf: true },
    });

    const folder = await ensureConsultaFolder({
      medicoId,
      pacienteId,
      nome: paciente?.nome ?? "paciente",
      cpf: paciente?.cpf ?? null,
      consultaId: created.id,
      data: created.data,
    });

    console.log("[consultas/novo] pasta da consulta:", folder);

    await prisma.consulta.update({
      where: { id: created.id },
      data: { pastaPath: folder },
    });

    await ensureEventForConsulta(created.id);

    return NextResponse.json({ id: created.id, pastaPath: folder }, { status: 201 });
  } catch (e) {
    console.error("[consultas/novo][POST]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
