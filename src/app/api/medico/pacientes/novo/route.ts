import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

function parseBrDate(d?: string | null): Date | null {
  if (!d) return null;
  // aceita "dd/mm/aaaa"
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d.trim());
  if (!m) return null;
  const [_, dd, mm, yyyy] = m;
  // mês = 0..11
  const dt = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return isNaN(dt.getTime()) ? null : dt;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = (session.user as any)?.role as "ADMIN" | "MEDICO";
    const medicoId = (session.user as any)?.medicoId as number | null;
    if (role !== "MEDICO" || !medicoId) {
      return NextResponse.json({ error: "Somente médico pode criar" }, { status: 403 });
    }

    const body = await req.json();
    const {
      nome,
      cpf,
      telefone,
      email,
      nascimento,        // string "dd/mm/aaaa" (opcional)
    } = body as {
      nome: string; cpf: string; telefone?: string | null; email?: string | null; nascimento?: string | null;
    };

    const nasc = parseBrDate(nascimento);

    const novo = await prisma.paciente.create({
      data: {
        medicoId,
        nome: nome.trim(),
        cpf: cpf.trim(),
        telefone: telefone?.trim() || null,
        email: email?.trim() || null,
        nascimento: nasc,   // Date | null
      },
      select: { id: true },
    });

    return NextResponse.json(novo, { status: 201 });
  } catch (e: any) {
    // CPF duplicado (unique)
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "CPF já cadastrado" }, { status: 409 });
    }
    console.error("POST /api/medico/pacientes/novo error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
