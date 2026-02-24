import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

type Ctx = { params: Promise<{ id: string }> };

async function requireAdmin() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Não autenticado" }, { status: 401 }),
    };
  }

  if ((session.user as { role?: string }).role !== "ADMIN") {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Acesso negado" }, { status: 403 }),
    };
  }

  return { ok: true as const, session };
}

type PutBody = {
  name?: string;
  email?: string;
  password?: string;
  role?: "ADMIN" | "MEDICO";
  crm?: string;
};

export async function PUT(req: NextRequest, ctx: Ctx) {
  const check = await requireAdmin();
  if (!check.ok) return check.res;

  const { id: idStr } = await ctx.params;
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const body = (await req.json()) as PutBody;
  const { name, email, password, role, crm } = body;

  if (!name || !email || !role) {
    return NextResponse.json(
      { error: "Nome, e-mail e papel são obrigatórios" },
      { status: 400 }
    );
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { id },
      include: { medico: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    const data: {
      name: string;
      email: string;
      role: "ADMIN" | "MEDICO";
      hashedPwd?: string;
    } = { name, email, role };

    if (password && password.trim().length > 0) {
      data.hashedPwd = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id },
        data,
      });

      if (role === "MEDICO") {
        if (existing.medico) {
          await tx.medico.update({
            where: { id: existing.medico.id },
            data: { crm: crm || null },
          });
        } else {
          await tx.medico.create({
            data: {
              userId: id,
              crm: crm || null,
            },
          });
        }
      } else {
        if (existing.medico) {
          await tx.medico.update({
            where: { id: existing.medico.id },
            data: { crm: null },
          });
        }
      }

      return u;
    });

    return NextResponse.json({
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      status: updatedUser.status,
    });
  } catch (err) {
    console.error("Erro PUT /api/admin/users/[id]:", err);
    return NextResponse.json({ error: "Erro ao atualizar usuário" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const check = await requireAdmin();
  if (!check.ok) return check.res;

  const { id: idStr } = await ctx.params;
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const medico = await tx.medico.findUnique({
        where: { userId: id },
        select: { id: true },
      });

      if (medico) {
        const medicoId = medico.id;

        await tx.laudoJob.deleteMany({ where: { medicoId } });
        await tx.agendaEvento.deleteMany({ where: { medicoId } });
        await tx.consulta.deleteMany({ where: { medicoId } });
        await tx.paciente.deleteMany({ where: { medicoId } });

        await tx.medico.delete({ where: { id: medicoId } });
      }

      await tx.user.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Erro DELETE /api/admin/users/[id]:", err);
    return NextResponse.json(
      { error: "Erro ao excluir usuário (hard delete)" },
      { status: 500 }
    );
  }
}