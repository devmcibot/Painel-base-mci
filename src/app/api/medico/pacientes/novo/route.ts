// src/app/api/medico/pacientes/novo/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { ensureFolder, patientFolderPath } from "@/lib/storage";

export const dynamic = "force-dynamic";

function parseBrDate(d?: string | null): Date | null {
  if (!d) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d.trim());
  if (!m) return null;
  const [_, dd, mm, yyyy] = m;
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
    const { nome, cpf, telefone, email, nascimento } = body as {
      nome: string;
      cpf: string;
      telefone?: string | null;
      email?: string | null;
      nascimento?: string | null; // "dd/mm/aaaa"
    };

    const nasc = parseBrDate(nascimento);

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
      select: { id: true, nome: true, cpf: true }, // já traz pra montar a pasta
    });

    // 2) monta o caminho determinístico da pasta do paciente
    const folder = patientFolderPath({
      medicoId,
      pacienteId: novo.id,
      nome: novo.nome,
      cpf: novo.cpf,
    });

    // 3) materializa a pasta no Storage (subindo .keep)
    await ensureFolder(folder);

    // (opcional) se tiver `pastaPath` no schema:
    // await prisma.paciente.update({ where: { id: novo.id }, data: { pastaPath: folder } });

    return NextResponse.json({ id: novo.id, pastaPath: folder }, { status: 201 });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "CPF já cadastrado" }, { status: 409 });
    }
    console.error("POST /api/medico/pacientes/novo error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
