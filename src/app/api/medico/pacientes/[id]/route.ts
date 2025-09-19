import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";
import { patientFolderPath } from "@/lib/storage";

const BUCKET = process.env.SUPABASE_BUCKET!;

async function removeFolderRecursive(prefix: string) {
  const s = supabaseAdmin.storage.from(BUCKET);
  // DFS simples
  const stack = [prefix];
  const toDelete: string[] = [];
  while (stack.length) {
    const dir = stack.pop()!;
    const { data, error } = await s.list(dir, { limit: 1000 });
    if (error) throw error;
    for (const it of data ?? []) {
      const full = `${dir}/${it.name}`;
      // arquivos têm "id" definido; pastas não (metadata === null)
      if ((it as any).id) toDelete.push(full);
      else stack.push(full);
    }
  }
  if (toDelete.length) await s.remove(toDelete);
  // tenta remover .keep se existir
  await s.remove([`${prefix}/.keep`]).catch(() => {});
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const medicoId = (session?.user as any)?.medicoId as number | null;
    if (!medicoId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const id = Number(params.id);
    if (!id || Number.isNaN(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

    const p = await prisma.paciente.findFirst({
      where: { id, medicoId },
      select: { id: true, nome: true, cpf: true },
    });
    if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // apaga arquivos/pasta
    const folder = patientFolderPath({
      medicoId,
      pacienteId: p.id,
      nome: p.nome,
      cpf: p.cpf,
    });
    await removeFolderRecursive(folder).catch((e) => {
      console.warn("removeFolderRecursive error (ignorado):", e?.message ?? e);
    });

    // apaga do banco (cascata dos relacionamentos deve estar no schema)
    await prisma.paciente.delete({ where: { id } });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    console.error("DELETE paciente error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
