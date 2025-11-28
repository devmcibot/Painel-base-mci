// src/app/api/admin/users/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

type RouteContext = {
  params: { id: string };
};

// Garante que é ADMIN
async function requireAdmin() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return {
      ok: false,
      res: NextResponse.json({ error: "Não autenticado" }, { status: 401 }),
    };
  }

  if ((session.user as any).role !== "ADMIN") {
    return {
      ok: false,
      res: NextResponse.json({ error: "Acesso negado" }, { status: 403 }),
    };
  }

  return { ok: true, session };
}

// =====================
// PUT  -> editar usuário
// =====================
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const check = await requireAdmin();
  if (!check.ok) return check.res;

  const id = Number(params.id);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const body = await req.json();
  const { name, email, password, role, crm } = body as {
    name?: string;
    email?: string;
    password?: string;
    role?: "ADMIN" | "MEDICO";
    crm?: string;
  };

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
      return NextResponse.json(
        { error: "Usuário não encontrado" },
        { status: 404 }
      );
    }

    const data: any = {
      name,
      email,
      role,
    };

    // Usa o campo correto do Prisma: hashedPwd
    if (password && password.trim().length > 0) {
      const hash = await bcrypt.hash(password, 10);
      data.hashedPwd = hash;
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id },
        data,
      });

      // Se for MÉDICO, garante Medico + CRM
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
        // Se virar ADMIN, zera CRM se existir Medico
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
    return NextResponse.json(
      { error: "Erro ao atualizar usuário" },
      { status: 500 }
    );
  }
}

// EXCLUIR usuário + todo histórico vinculado ao médico
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const check = await requireAdmin();
  if (!check.ok) return check.res;

  const id = Number(params.id);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      // pega médico vinculado a esse user (se existir)
      const medico = await tx.medico.findUnique({
        where: { userId: id },
        select: { id: true },
      });

      if (medico) {
        const medicoId = medico.id;

        // 1) Laudos do médico
        await tx.laudoJob.deleteMany({ where: { medicoId } });

        // 2) Eventos de agenda do médico
        await tx.agendaEvento.deleteMany({ where: { medicoId } });

        // 3) Consultas do médico (Transcript / ExternalLink / etc caem por cascade)
        await tx.consulta.deleteMany({ where: { medicoId } });

        // 4) Pacientes desse médico
        await tx.paciente.deleteMany({ where: { medicoId } });

        // 5) Médico em si (horários/ausências caem por cascade)
        await tx.medico.delete({
          where: { id: medicoId },
        });
      }

      // 6) Usuário
      await tx.user.delete({
        where: { id },
      });
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
