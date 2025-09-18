import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { fromLocalInputToUTC, toDate } from "@/src/lib/datetime";
import { ensureEventForConsulta } from "@/src/lib/agenda-sync";

export const dynamic = "force-dynamic";

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

    // body.data pode vir como string de <input datetime-local> ("YYYY-MM-DDTHH:mm")
    // ou um ISO já UTC. Tratamos os dois.
    const data: Date =
      typeof body.data === "string" && body.data.includes("T")
        ? fromLocalInputToUTC(body.data)
        : toDate(body.data);

    const created = await prisma.consulta.create({
      data: {
        medicoId,
        pacienteId,
        data,
        status: "ABERTA",
      },
      select: { id: true },
    });

    await ensureEventForConsulta(created.id);

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (e) {
    console.error("[consultas/novo][POST]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
