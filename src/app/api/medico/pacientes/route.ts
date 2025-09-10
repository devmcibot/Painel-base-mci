import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role   = (session.user as any)?.role as "ADMIN" | "MEDICO";
    const sMedId = (session.user as any)?.medicoId as number | null;

    const url = new URL(req.url);
    const qpMedId = url.searchParams.get("medicoId");
    const qpMedIdNum = qpMedId ? Number(qpMedId) : null;

    let medicoIdParaBuscar: number | null = null;
    if (role === "MEDICO") {
      if (!sMedId) return NextResponse.json({ error: "Sem vínculo de médico" }, { status: 403 });
      medicoIdParaBuscar = sMedId;
    } else if (role === "ADMIN") {
      medicoIdParaBuscar = qpMedIdNum ?? null;
    }

    const pacientes = await prisma.paciente.findMany({
      where: medicoIdParaBuscar ? { medicoId: medicoIdParaBuscar } : undefined,
      select: { id: true, nome: true, cpf: true, email: true, telefone: true, nascimento: true },
      orderBy: { id: "asc" },
    });

    return NextResponse.json(pacientes);
  } catch (err) {
    console.error("GET /api/medico/pacientes error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
