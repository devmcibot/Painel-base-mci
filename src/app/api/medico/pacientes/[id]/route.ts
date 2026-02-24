import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";
import { patientFolderPath } from "@/lib/storage";

const BUCKET = process.env.SUPABASE_BUCKET!;

async function removeFolderRecursive(prefix: string) {
  const s = supabaseAdmin.storage.from(BUCKET);
  const stack = [prefix];
  const toDelete: string[] = [];

  while (stack.length) {
    const dir = stack.pop()!;
    const { data, error } = await s.list(dir, { limit: 1000 });
    if (error) throw error;

    for (const it of data ?? []) {
      const full = `${dir}/${it.name}`;
      // arquivos têm "id" definido; pastas não
      if ((it as { id?: string | null }).id) toDelete.push(full);
      else stack.push(full);
    }
  }

  if (toDelete.length) await s.remove(toDelete);

  // tenta remover .keep se existir (ignora erro)
  try {
    await s.remove([`${prefix}/.keep`]);
  } catch {}
}

function parseDateOnlyToUtcNoon(yyyyMmDd: string): Date | null {
  // Espera "YYYY-MM-DD"
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd);
  if (!m) return null;

  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;

  // Meio-dia UTC evita “voltar um dia” por timezone
  return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
}

type PatchBody = {
  nome?: string;
  cpf?: string;
  email?: string | null;
  telefone?: string | null;
  nascimento?: string | null; // "YYYY-MM-DD" | null
};

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    const medicoId = (session?.user as { medicoId?: number } | null)?.medicoId ?? null;
    if (!medicoId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: idStr } = await ctx.params;
    const id = Number(idStr);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "Bad id" }, { status: 400 });
    }

    const body = (await req.json()) as PatchBody;

    // Garante que o paciente pertence ao médico logado
    const existing = await prisma.paciente.findFirst({
      where: { id, medicoId },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data: {
      nome?: string;
      cpf?: string;
      email?: string | null;
      telefone?: string | null;
      nascimento?: Date | null;
    } = {};

    if (typeof body.nome === "string") data.nome = body.nome.trim();
    if (typeof body.cpf === "string") data.cpf = body.cpf.trim();
    if (body.email === null || typeof body.email === "string") data.email = body.email ? body.email.trim() : null;
    if (body.telefone === null || typeof body.telefone === "string")
      data.telefone = body.telefone ? body.telefone.trim() : null;

    if (body.nascimento === null) {
      data.nascimento = null;
    } else if (typeof body.nascimento === "string" && body.nascimento.length > 0) {
      const parsed = parseDateOnlyToUtcNoon(body.nascimento);
      if (!parsed) {
        return NextResponse.json({ error: "nascimento inválido (use YYYY-MM-DD)" }, { status: 400 });
      }
      data.nascimento = parsed;
    }

    // nada pra atualizar
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
    }

    const updated = await prisma.paciente.update({
      where: { id },
      data,
      select: {
        id: true,
        nome: true,
        cpf: true,
        email: true,
        telefone: true,
        nascimento: true,
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    console.error("PATCH paciente error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    const medicoId = (session?.user as { medicoId?: number } | null)?.medicoId ?? null;
    if (!medicoId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: idStr } = await ctx.params;
    const id = Number(idStr);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "Bad id" }, { status: 400 });
    }

    const p = await prisma.paciente.findFirst({
      where: { id, medicoId },
      select: { id: true, nome: true, cpf: true },
    });
    if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const folder = patientFolderPath({
      medicoId,
      pacienteId: p.id,
      nome: p.nome,
      cpf: p.cpf,
    });

    await removeFolderRecursive(folder).catch((e) => {
      console.warn("removeFolderRecursive error (ignorado):", (e as Error)?.message ?? e);
    });

    await prisma.paciente.delete({ where: { id } });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("DELETE paciente error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}