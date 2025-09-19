import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";
import { patientFolderPath } from "@/lib/storage";

const BUCKET = process.env.SUPABASE_BUCKET!;

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const medicoId = (session?.user as any)?.medicoId ?? null;
    if (!medicoId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const ids: number[] = Array.isArray(body?.ids)
      ? body.ids.map((n: any) => Number(n)).filter((n: any) => Number.isFinite(n))
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: "Nenhum id informado" }, { status: 400 });
    }

    // pega dados p/ apagar pastas
    const pacientes = await prisma.paciente.findMany({
      where: { id: { in: ids }, medicoId },
      select: { id: true, nome: true, cpf: true },
    });

    // apaga consultas vinculadas
    await prisma.consulta.deleteMany({
      where: { pacienteId: { in: ids }, medicoId },
    });

    // apaga pacientes
    await prisma.paciente.deleteMany({
      where: { id: { in: ids }, medicoId },
    });

    // remove pastas no Storage
    if (pacientes.length > 0) {
      const paths = pacientes.map((p) =>
        patientFolderPath({
          medicoId,
          pacienteId: p.id,
          nome: p.nome,
          cpf: p.cpf ?? undefined,
        })
      );
      // remove recursivamente cada pasta
      await Promise.all(
        paths.map(async (path) => {
          await supabaseAdmin.storage.from(BUCKET).remove([path]); // remove dir “virtual”
        })
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("bulk-delete error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
