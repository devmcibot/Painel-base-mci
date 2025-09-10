// src/app/api/admin/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route"; // ← 2 níveis pra cima
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    name,
    email,
    password,
    crm,
    role,
  }: {
    name: string;
    email: string;
    password: string;
    crm?: string;
    role?: "ADMIN" | "MEDICO";
  } = body;

  if (!name || !email || !password) {
    return NextResponse.json(
      { error: "Campos obrigatórios: name, email, password" },
      { status: 400 }
    );
  }

  const roleFinal: "ADMIN" | "MEDICO" = role === "ADMIN" ? "ADMIN" : "MEDICO";

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return NextResponse.json({ error: "E-mail já cadastrado" }, { status: 409 });
  }

  const hash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { name, email, hashedPwd: hash, role: roleFinal, status: "ACTIVE" },
    select: { id: true, email: true, name: true, role: true, status: true },
  });

  if (roleFinal === "MEDICO") {
    await prisma.medico.create({
      data: { userId: user.id, crm: crm ?? null },
    });
  }

  return NextResponse.json(user, { status: 201 });
}

export async function GET() {
  const users = await prisma.user.findMany({
    orderBy: { id: "desc" },
    select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
  });
  return NextResponse.json(users);
}
