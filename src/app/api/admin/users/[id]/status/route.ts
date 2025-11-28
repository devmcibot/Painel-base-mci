import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

type RouteContext = {
  params: { id: string };
};

// middleware simples pra garantir ADMIN
async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { ok: false, res: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) };
  }
  if ((session.user as any).role !== "ADMIN") {
    return { ok: false, res: NextResponse.json({ error: "Acesso negado" }, { status: 403 }) };
  }
  return { ok: true, session };
}

// EDITAR usuário
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

  const data: any = {
    name,
    email,
    role,
    crm: role === "MEDICO" ? crm || null : null,
  };

  if (password && password.trim().length > 0) {
    const hash = await bcrypt.hash(password, 10);
    data.passwordHash = hash; // ajuste pro nome do campo que você usa no Prisma
  }

  try {
    const updated = await prisma.user.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      status: updated.status,
      crm: (updated as any).crm ?? null,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erro ao atualizar usuário" }, { status: 500 });
  }
}

// EXCLUIR usuário
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const check = await requireAdmin();
  if (!check.ok) return check.res;

  const id = Number(params.id);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  try {
    // opcional: impedir que o admin exclua a si mesmo
    // const sessionUserId = (check.session!.user as any).id;
    // if (sessionUserId === id) {
    //   return NextResponse.json(
    //     { error: "Você não pode excluir o próprio usuário logado" },
    //     { status: 400 }
    //   );
    // }

    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erro ao excluir usuário" }, { status: 500 });
  }
}
