// src/app/api/medico/consultas/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/medico/consultas
 * Lista SOMENTE as consultas do médico logado, já incluindo paciente
 * e os campos que a tela de Anamnese usa.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const medicoId = (session?.user as any)?.medicoId ?? null;
    if (!medicoId) {
      return NextResponse.json({ error: "Sem médico vinculado" }, { status: 401 });
    }

    const consultas = await prisma.consulta.findMany({
      where: { medicoId },
      orderBy: { data: "desc" },
      include: {
        paciente: { select: { id: true, nome: true, cpf: true } },
      },
    });

    // Retorna só o que a Anamnese consome
    const payload = consultas.map((c) => ({
      id: c.id,
      data: c.data.toISOString(),
      pastaPath: c.pastaPath, // pode ser null
      paciente: {
        id: c.paciente.id,
        nome: c.paciente.nome,
        cpf: c.paciente.cpf,
      },
    }));

    return NextResponse.json(payload, { status: 200 });
  } catch (e) {
    console.error("GET /api/medico/consultas error:", e);
    return NextResponse.json({ error: "Falha ao listar" }, { status: 500 });
  }
}

/* 
// Se você NÃO usa esta rota para criar (porque já cria pela Agenda), pode remover o POST.
// Deixo aqui só como referência, comentado:
//
// export async function POST(req: Request) { ... }
*/
