// src/app/api/medico/pacientes/novo/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { ensureFolder, patientFolderPath } from "@/lib/storage";

export const dynamic = "force-dynamic";

// aceita dd/mm/aaaa ou dd/mm/aa (aa -> 19xx/20xx)
function parseBrDateFlexible(d?: string | null): Date | null {
  if (!d) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/.exec(d.trim());
  if (!m) return null;
  const [, dd, mm, yy] = m;
  let year = Number(yy);
  if (yy.length === 2) {
    year = year >= 50 ? 1900 + year : 2000 + year;
  }
  const dt = new Date(year, Number(mm) - 1, Number(dd));
  return isNaN(dt.getTime()) ? null : dt;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as any)?.role as "ADMIN" | "MEDICO" | undefined;
    const medicoId = (session.user as any)?.medicoId as number | undefined;
    if (role !== "MEDICO" || !medicoId) {
      return NextResponse.json({ error: "Somente médico pode criar" }, { status: 403 });
    }

    const body = await req.json();
    const { nome, cpf, telefone, email, nascimento } = (body ?? {}) as {
      nome: string;
      cpf: string;
      telefone?: string | null;
      email?: string | null;
      nascimento?: string | null; // "dd/mm/aaaa" ou "dd/mm/aa"
    };

    if (!nome?.trim() || !cpf?.trim()) {
      return NextResponse.json({ error: "Nome e CPF são obrigatórios" }, { status: 400 });
    }

    const nasc = parseBrDateFlexible(nascimento);

    // 1) cria no banco
    const novo = await prisma.paciente.create({
      data: {
        medicoId,
        nome: nome.trim(),
        cpf: cpf.trim(),
        telefone: telefone?.trim() || null,
        email: email?.trim() || null,
        nascimento: nasc,
      },
      select: { id: true, nome: true, cpf: true },
    });

    // 2) pasta no storage
    const folder = patientFolderPath({
      medicoId,
      pacienteId: novo.id,
      nome: novo.nome,
      cpf: novo.cpf,
    });
    await ensureFolder(folder); // cria a pasta com .keep, idempotente

    return NextResponse.json({ id: novo.id, pastaPath: folder }, { status: 201 });
  } catch (e: any) {
    // unique index do CPF
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "CPF já cadastrado" }, { status: 409 });
    }
    console.error("POST /api/medico/pacientes/novo error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
