import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };
type Body = { status?: "ACTIVE" | "BLOCKED" };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: idStr } = await ctx.params;
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const { status } = (await req.json()) as Body;

  if (status !== "ACTIVE" && status !== "BLOCKED") {
    return NextResponse.json({ error: "status inválido" }, { status: 400 });
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: { status },
      select: { id: true, email: true, name: true, role: true, status: true },
    });

    return NextResponse.json(user);
  } catch (err) {
    console.error("Erro PATCH /api/admin/users/[id]/status:", err);
    return NextResponse.json(
      { error: "Erro ao alterar status do usuário" },
      { status: 500 }
    );
  }
}